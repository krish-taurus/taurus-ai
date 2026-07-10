/**
 * Microsoft Teams connect + events runtime (Sprint 043) — server only.
 *
 * connectTeams stores the AAD app credentials (encrypted) and creates an active
 * Teams connection bound to a workspace (tenant). processTeamsActivity validates
 * the Bot Framework JWT, routes by tenant, stashes the reply serviceUrl, and
 * hands the message to the shared messaging runtime (which replies via the Bot
 * Connector).
 */

import type { AiEmployee, EmployeeChannel } from "@/lib/db/types";
import type { DataStore } from "@/lib/db/store";
import type { ChatGateway } from "@/modules/employee-chat/service";
import { isProductionRuntime } from "@/modules/model-gateway/credential-resolver";
import { generatePublicKey } from "@/modules/channels/keys";
import { defaultAppearance } from "@/modules/channels/appearance";
import { saveProviderCredential, type MessagingActor } from "@/modules/channels/messaging/service";
import { resolveProviderConfig } from "@/modules/channels/messaging/config";
import { handleInboundMessagingMessage } from "@/modules/channels/messaging/runtime";
import type { WebhookRequest } from "@/modules/channels/messaging/types";
import { teamsProvider } from "@/modules/channels/teams/provider";
import {
  parseActivity,
  verifyInboundToken,
  fetchConnectorJwks,
  type RsaJwk,
} from "@/modules/channels/teams/bot-framework";

/** Persist AAD credentials + create/refresh the employee's Teams connection. */
export async function connectTeams(
  store: DataStore,
  actor: MessagingActor,
  input: { employee: AiEmployee; appId: string; appPassword: string; tenantId: string; tenantName?: string | null },
): Promise<EmployeeChannel> {
  const { employee, appId, appPassword, tenantId } = input;
  await saveProviderCredential(store, actor, "microsoft_graph", { appId, appPassword }, input.tenantName ?? null);

  const providerConfig = { tenant_id: tenantId, app_id: appId, tenant_name: input.tenantName ?? null };
  const existing = (
    await store.listEmployeeChannelsForEmployee(actor.organizationId, employee.id)
  ).find((c) => c.channelType === "microsoft_teams" && c.status !== "archived");

  if (existing) {
    await store.updateEmployeeChannel(actor.organizationId, existing.id, { providerConfig });
    await store.activateEmployeeChannel(actor.organizationId, existing.id);
    return (await store.getEmployeeChannel(actor.organizationId, existing.id)) ?? existing;
  }
  const channel = await store.createEmployeeChannel({
    organizationId: actor.organizationId,
    employeeId: employee.id,
    channelType: "microsoft_teams",
    channelProvider: "microsoft_graph",
    publicKey: generatePublicKey(),
    name: input.tenantName ? `Teams · ${input.tenantName}` : "Microsoft Teams",
    status: "draft",
    allowedDomains: [],
    appearance: { ...defaultAppearance(employee), employeeDisplayName: employee.name },
    providerConfig,
    welcomeMessage: null,
    createdByUserId: actor.userId,
  });
  await store.activateEmployeeChannel(actor.organizationId, channel.id);
  return (await store.getEmployeeChannel(actor.organizationId, channel.id)) ?? channel;
}

export interface TeamsEventDeps {
  store: DataStore;
  gateway: ChatGateway;
  isProduction?: () => boolean;
  /** Injected for tests; production fetches the Bot Framework JWKS. */
  loadJwks?: () => Promise<RsaJwk[]>;
}

export interface TeamsEventResult {
  status: number;
  body: string;
}

const OK: TeamsEventResult = { status: 200, body: "" };

/** Process one inbound Bot Framework Activity. */
export async function processTeamsActivity(
  deps: TeamsEventDeps,
  params: { rawBody: string; headers: Record<string, string> },
): Promise<TeamsEventResult> {
  const { store } = deps;
  const isProduction = deps.isProduction ?? isProductionRuntime;

  let json: unknown;
  try {
    json = JSON.parse(params.rawBody);
  } catch {
    return { status: 400, body: "bad_request" };
  }
  const activity = parseActivity(json);
  if (!activity || !activity.tenantId) return OK;

  const channel = await store.getEmployeeChannelByTeamsTenant(activity.tenantId);
  if (!channel) return OK; // unknown tenant — ack so the Connector stops retrying

  const config = await resolveProviderConfig(store, channel, teamsProvider);

  // Verify the Bot Framework JWT in production; accept in simulated/dev.
  if (config.mode === "live" && isProduction()) {
    const appId = config.secrets.appId ?? "";
    const jwks = deps.loadJwks ? await deps.loadJwks() : await fetchConnectorJwks();
    const ok = verifyInboundToken({ authHeader: params.headers.authorization, appId, jwks });
    if (!ok) {
      await store.createChannelWebhookEvent({
        organizationId: channel.organizationId,
        channelId: channel.id,
        providerType: "microsoft_graph",
        eventType: "error",
        status: "failed",
        errorCode: "unverified",
        metadata: { reason: "bad_jwt" },
      });
      return { status: 401, body: "unauthorized" };
    }
  }

  // Stash the reply serviceUrl on the connection so sendMessage can use it.
  if (channel.providerConfig?.serviceUrl !== activity.serviceUrl) {
    await store.updateEmployeeChannel(channel.organizationId, channel.id, {
      providerConfig: { ...channel.providerConfig, serviceUrl: activity.serviceUrl },
    });
  }
  const fresh = (await store.getEmployeeChannel(channel.organizationId, channel.id)) ?? channel;
  const freshConfig = await resolveProviderConfig(store, fresh, teamsProvider);

  const request: WebhookRequest = {
    method: "POST",
    url: "",
    headers: params.headers,
    query: {},
    rawBody: params.rawBody,
    form: {},
    json,
  };
  const inbound = teamsProvider.parseInboundWebhook(request);
  if (!inbound) return OK;

  await handleInboundMessagingMessage(deps, {
    channel: fresh,
    provider: teamsProvider,
    config: freshConfig,
    inbound,
  });
  return OK;
}
