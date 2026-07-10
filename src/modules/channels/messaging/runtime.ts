/**
 * Messaging channel runtime (Prompt 009) — server only.
 *
 * Extends the channel runtime to messaging: it takes a normalized inbound message
 * (from a provider adapter or the simulate panel), enforces channel/employee/DNA
 * status and contact block status, gets or creates an isolated conversation, and
 * REUSES the Employee Chat Runtime (Model Gateway only) to generate the reply.
 * The reply goes out via the provider adapter when live, or is stored as
 * simulated. All events are metadata-only.
 */

import type { AiEmployee, EmployeeChannel } from "@/lib/db/types";
import type { DataStore } from "@/lib/db/store";
import type { ChatGateway } from "@/modules/employee-chat/service";
import { ChatBlockedError, sendChatMessage } from "@/modules/employee-chat/service";
import { runWorkflow } from "@/modules/workflows/engine";
import { hashContact } from "@/modules/channels/keys";
import type {
  MessagingInboundMessage,
  MessagingProvider,
  MessagingProviderConfig,
  ProviderSendResult,
} from "@/modules/channels/messaging/types";

export type MessagingRejectReason =
  | "inactive"
  | "employee_unavailable"
  | "needs_dna"
  | "blocked"
  | "failed";

export interface MessagingRuntimeDeps {
  store: DataStore;
  gateway: ChatGateway;
  isProduction?: () => boolean;
}

export interface HandleMessagingParams {
  channel: EmployeeChannel;
  provider: MessagingProvider;
  config: MessagingProviderConfig;
  inbound: MessagingInboundMessage;
}

export interface MessagingRuntimeResult {
  status: "processed" | "rejected";
  reason?: MessagingRejectReason;
  conversationId?: string;
  outboundStatus?: ProviderSendResult["status"];
  replyText?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function audit(
  store: DataStore,
  channel: EmployeeChannel,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  // System actor (no dashboard user); metadata only, never message content.
  await store.createAuditEvent({
    organizationId: channel.organizationId,
    actorType: "system",
    actorId: null,
    action,
    targetType: "employee_channel",
    targetId: channel.id,
    metadata: { channelId: channel.id, channelType: channel.channelType, ...metadata },
  });
}

/**
 * Process one normalized inbound messaging message end to end.
 */
export async function handleInboundMessagingMessage(
  deps: MessagingRuntimeDeps,
  params: HandleMessagingParams,
): Promise<MessagingRuntimeResult> {
  const { store, gateway } = deps;
  const { channel, provider, config, inbound } = params;
  const orgId = channel.organizationId;

  const reject = async (
    reason: MessagingRejectReason,
    webhookEventId?: string,
  ): Promise<MessagingRuntimeResult> => {
    if (webhookEventId) {
      await store.updateChannelWebhookEventStatus(webhookEventId, {
        status: "failed",
        processedAt: nowIso(),
        errorCode: reason,
      });
    }
    await audit(store, channel, "messaging_webhook.failed", { reason });
    return { status: "rejected", reason };
  };

  // --- Governance gates ----------------------------------------------------
  if (channel.status !== "active") return reject("inactive");

  const employee: AiEmployee | null = await store.getEmployee(orgId, channel.employeeId);
  if (!employee || employee.status === "archived") return reject("employee_unavailable");

  const published = await store.getPublishedEmployeeDna(orgId, employee.id);
  if (!published) return reject("needs_dna");

  // --- Compliance: contact block / implicit opt-in -------------------------
  const contactHash = await hashContact(inbound.senderExternalId);
  const existingPref = await store.getMessagingContactPreference(orgId, channel.id, contactHash);
  if (existingPref?.optInStatus === "blocked") {
    await audit(store, channel, "messaging_message.inbound_received", { blocked: true });
    return { status: "rejected", reason: "blocked" };
  }
  await store.upsertMessagingContactPreference({
    organizationId: orgId,
    channelId: channel.id,
    normalizedContactHash: contactHash,
    channelType: channel.channelType,
    // Messaging us is implicit opt-in for this conversation.
    optInStatus: existingPref?.optInStatus === "opted_out" ? "opted_out" : "opted_in",
  });

  // --- Record inbound webhook event (metadata only) ------------------------
  const webhookEvent = await store.createChannelWebhookEvent({
    organizationId: orgId,
    channelId: channel.id,
    providerType: channel.channelProvider,
    eventType: "inbound",
    externalEventId: inbound.externalMessageId || null,
    status: "received",
    metadata: { channelType: channel.channelType, contentType: inbound.contentType },
  });
  await audit(store, channel, "messaging_webhook.received", {
    providerType: channel.channelProvider,
  });
  await audit(store, channel, "messaging_message.inbound_received", {
    contentType: inbound.contentType,
  });

  const organization = await store.getOrganizationById(orgId);
  const organizationName = organization?.name ?? "our company";

  // --- Workflow-triggered channel? -----------------------------------------
  // If an active workflow is bound to this channel, it OWNS the response: the
  // message starts a run (with the sender available as {{trigger.sender}}) and
  // the workflow's own Send message steps reply. The default auto-reply is
  // skipped so the customer doesn't get two answers.
  const boundWorkflow = await store.getActiveChannelWorkflow(orgId, channel.id);
  if (boundWorkflow) {
    try {
      await runWorkflow(deps, {
        workflow: boundWorkflow,
        organizationName,
        actor: { organizationId: orgId, userId: null },
        triggeredBy: "channel",
        input: {
          message: inbound.messageText,
          sender: inbound.senderExternalId,
          senderLabel: inbound.senderLabel ?? "",
          channelId: channel.id,
        },
      });
    } catch {
      // A workflow failure must not 500 the provider's webhook.
    }
    await store.updateChannelWebhookEventStatus(webhookEvent.id, {
      status: "processed",
      processedAt: nowIso(),
    });
    await audit(store, channel, "messaging_webhook.processed", { viaWorkflow: boundWorkflow.id });
    return { status: "processed" };
  }

  // --- Conversation (isolated per contact) ---------------------------------
  const session = await store.getOrCreatePublicChatSession({
    organizationId: orgId,
    employeeId: employee.id,
    channelId: channel.id,
    visitorId: contactHash,
    visitorLabel: inbound.senderLabel,
  });

  // --- Generate via the Employee Chat Runtime (Model Gateway only) ---------
  let replyText: string;
  try {
    const result = await sendChatMessage(
      { store, gateway, isProduction: deps.isProduction },
      {
        actor: { organizationId: orgId, userId: null, actorType: "system" },
        organizationName,
        employee,
        threadId: session.threadId,
        message: inbound.messageText,
        channelType: channel.channelType,
      },
    );
    replyText = result.assistantMessage.content;
  } catch (error) {
    const reason: MessagingRejectReason =
      error instanceof ChatBlockedError && error.reason === "needs_dna"
        ? "needs_dna"
        : error instanceof ChatBlockedError && error.reason === "archived"
          ? "employee_unavailable"
          : "failed";
    return reject(reason, webhookEvent.id);
  }

  // --- Send outbound via the provider (or store as simulated) --------------
  const mode = provider.getProviderStatus(config).mode;
  const subject =
    typeof inbound.metadata.subject === "string" ? `Re: ${inbound.metadata.subject}` : undefined;

  let send: ProviderSendResult;
  if (mode === "live") {
    send = await provider.sendMessage(
      {
        providerType: channel.channelProvider,
        channelType: channel.channelType,
        recipientExternalId: inbound.senderExternalId,
        messageText: replyText,
        conversationId: session.id,
        channelId: channel.id,
        metadata: subject ? { subject } : {},
      },
      config,
    );
  } else {
    send = { status: "simulated", externalMessageId: null, errorCode: null };
  }

  // --- Delivery foundation + processed event -------------------------------
  await store.createChannelWebhookEvent({
    organizationId: orgId,
    channelId: channel.id,
    providerType: channel.channelProvider,
    eventType: "delivery_status",
    externalEventId: send.externalMessageId,
    status: send.status === "failed" ? "failed" : "processed",
    metadata: { outboundStatus: send.status, deliveryStatus: send.status },
    processedAt: nowIso(),
    errorCode: send.errorCode,
  });
  await store.updateChannelWebhookEventStatus(webhookEvent.id, {
    status: "processed",
    processedAt: nowIso(),
  });
  await audit(store, channel, "messaging_message.outbound_sent", {
    outboundStatus: send.status,
    providerType: channel.channelProvider,
    mode,
  });
  await audit(store, channel, "messaging_webhook.processed", {});

  return {
    status: "processed",
    conversationId: session.id,
    outboundStatus: send.status,
    replyText,
  };
}
