/**
 * Public channel runtime (Prompt 008) — server only.
 *
 * Resolves a channel from its PUBLIC KEY (never from client-supplied org/employee
 * ids), enforces channel + employee + DNA status, gets or creates an isolated
 * visitor session, and delegates generation to the channel provider — which for
 * web reuses the Employee Chat Runtime (Model Gateway only). Records metadata-only
 * channel events. Never exposes internal ids, storage paths, keys, or raw errors.
 */

import type { DataStore } from "@/lib/db/store";
import type { ChatGateway } from "@/modules/employee-chat/service";
import { ChatBlockedError } from "@/modules/employee-chat/service";
import type { EmployeeChannel } from "@/lib/db/types";
import type { NormalizedOutboundMessage } from "@/modules/channels/types";
import { ChannelNotAvailableError } from "@/modules/channels/types";
import { getChannelProvider } from "@/modules/channels/providers";
import { generateVisitorId } from "@/modules/channels/keys";

export type PublicChannelErrorCode =
  | "not_found"
  | "inactive"
  | "employee_unavailable"
  | "needs_dna"
  | "not_available"
  | "failed";

export class PublicChannelError extends Error {
  constructor(readonly code: PublicChannelErrorCode) {
    super(`Public channel error: ${code}`);
    this.name = "PublicChannelError";
  }
}

export interface PublicChatDeps {
  store: DataStore;
  gateway: ChatGateway;
  isProduction?: () => boolean;
}

export interface PublicChatParams {
  publicKey: string;
  message: string;
  sessionId?: string | null;
  visitorId?: string | null;
  originDomain?: string | null;
  ipHash?: string | null;
  userAgentHash?: string | null;
}

export interface PublicChatResult {
  sessionId: string;
  outbound: NormalizedOutboundMessage;
  employee: { name: string; roleTitle: string };
  channel: EmployeeChannel;
}

/** Load and fully validate a channel for public use (status/employee/DNA). */
export async function resolveActiveChannel(
  store: DataStore,
  publicKey: string,
): Promise<{ channel: EmployeeChannel; employee: import("@/lib/db/types").AiEmployee }> {
  const channel = await store.getEmployeeChannelByPublicKey(publicKey);
  if (!channel) throw new PublicChannelError("not_found");
  if (channel.status !== "active") throw new PublicChannelError("inactive");

  const provider = getChannelProvider(channel.channelProvider);
  if (!provider.isAvailable()) throw new PublicChannelError("not_available");

  const employee = await store.getEmployee(channel.organizationId, channel.employeeId);
  if (!employee || employee.status === "archived") {
    throw new PublicChannelError("employee_unavailable");
  }

  const published = await store.getPublishedEmployeeDna(channel.organizationId, employee.id);
  if (!published) throw new PublicChannelError("needs_dna");

  return { channel, employee };
}

/** Process one public inbound message and return a normalized reply. */
export async function handlePublicChatMessage(
  deps: PublicChatDeps,
  params: PublicChatParams,
): Promise<PublicChatResult> {
  const { store, gateway } = deps;
  const { channel, employee } = await resolveActiveChannel(store, params.publicKey);
  const orgId = channel.organizationId;

  const organization = await store.getOrganizationById(orgId);
  const organizationName = organization?.name ?? "our company";

  // --- Session (isolated per visitor) --------------------------------------
  let session = params.sessionId
    ? await store.getPublicChatSession(channel.id, params.sessionId)
    : null;

  if (!session || session.status !== "active") {
    const visitorId = params.visitorId || generateVisitorId();
    session = await store.getOrCreatePublicChatSession({
      organizationId: orgId,
      employeeId: employee.id,
      channelId: channel.id,
      visitorId,
      originDomain: params.originDomain ?? null,
      ipHash: params.ipHash ?? null,
      userAgentHash: params.userAgentHash ?? null,
    });
    await store.createPublicChannelEvent({
      organizationId: orgId,
      employeeId: employee.id,
      channelId: channel.id,
      eventType: "public_chat.session_started",
      metadata: { channelType: channel.channelType, sessionId: session.id },
    });
  }

  await store.createPublicChannelEvent({
    organizationId: orgId,
    employeeId: employee.id,
    channelId: channel.id,
    eventType: "public_chat.message_sent",
    metadata: { channelType: channel.channelType, sessionId: session.id },
  });

  const provider = getChannelProvider(channel.channelProvider);

  let outbound: NormalizedOutboundMessage;
  try {
    outbound = await provider.handleInbound({
      store,
      gateway,
      channel,
      employee,
      organizationName,
      session,
      message: params.message,
      isProduction: deps.isProduction,
    });
  } catch (error) {
    await store.createPublicChannelEvent({
      organizationId: orgId,
      employeeId: employee.id,
      channelId: channel.id,
      eventType: "public_chat.response_failed",
      metadata: {
        channelType: channel.channelType,
        sessionId: session.id,
        reason: error instanceof ChatBlockedError ? error.reason : "error",
      },
    });
    // Governance gate failures surface as typed errors; everything else is generic.
    if (error instanceof ChatBlockedError) {
      if (error.reason === "needs_dna") throw new PublicChannelError("needs_dna");
      if (error.reason === "archived") throw new PublicChannelError("employee_unavailable");
      throw new PublicChannelError("inactive");
    }
    if (error instanceof ChannelNotAvailableError) throw new PublicChannelError("not_available");
    throw new PublicChannelError("failed");
  }

  await store.createPublicChannelEvent({
    organizationId: orgId,
    employeeId: employee.id,
    channelId: channel.id,
    eventType:
      outbound.status === "sent" ? "public_chat.response_generated" : "public_chat.response_failed",
    metadata: {
      channelType: channel.channelType,
      sessionId: session.id,
      demo: outbound.demo,
      retrievedSourceCount: outbound.sources.length,
      status: outbound.status,
    },
  });

  return {
    sessionId: session.id,
    outbound,
    employee: { name: employee.name, roleTitle: employee.roleTitle },
    channel,
  };
}
