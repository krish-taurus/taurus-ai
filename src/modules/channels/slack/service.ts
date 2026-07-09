/**
 * Slack connect + events runtime (Sprint 038) — server only.
 *
 * connectSlackWorkspace stores the OAuth bot token (encrypted) and creates an
 * active Slack connection for an employee. processSlackEvent handles Slack's
 * Events API: the one-time url_verification handshake, request-signature
 * verification, team-id routing, and handing inbound messages to the shared
 * messaging runtime (which replies via chat.postMessage).
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
import { slackProvider } from "@/modules/channels/slack/provider";
import { verifySlackSignature, type SlackInstall } from "@/modules/channels/slack/oauth";

/**
 * Persist a completed OAuth install: encrypt + store the bot token and create
 * (or refresh) the employee's active Slack connection bound to the workspace.
 */
export async function connectSlackWorkspace(
  store: DataStore,
  actor: MessagingActor,
  input: { employee: AiEmployee; install: SlackInstall },
): Promise<EmployeeChannel> {
  const { employee, install } = input;

  // Store the per-workspace bot token as an encrypted credential (provider slack).
  await saveProviderCredential(store, actor, "slack", { botToken: install.botToken }, install.teamName);

  const existing = (
    await store.listEmployeeChannelsForEmployee(actor.organizationId, employee.id)
  ).find((c) => c.channelType === "slack" && c.status !== "archived");

  const providerConfig = { team_id: install.teamId, team_name: install.teamName };

  if (existing) {
    await store.updateEmployeeChannel(actor.organizationId, existing.id, { providerConfig });
    await store.activateEmployeeChannel(actor.organizationId, existing.id);
    return (await store.getEmployeeChannel(actor.organizationId, existing.id)) ?? existing;
  }

  const channel = await store.createEmployeeChannel({
    organizationId: actor.organizationId,
    employeeId: employee.id,
    channelType: "slack",
    channelProvider: "slack",
    publicKey: generatePublicKey(),
    name: install.teamName ? `Slack · ${install.teamName}` : "Slack",
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

export interface SlackEventDeps {
  store: DataStore;
  gateway: ChatGateway;
  isProduction?: () => boolean;
}

export interface SlackEventResult {
  status: number;
  body: string;
  contentType?: string;
}

const OK: SlackEventResult = { status: 200, body: "" };

/** Process one inbound Slack Events API request. */
export async function processSlackEvent(
  deps: SlackEventDeps,
  params: { rawBody: string; headers: Record<string, string> },
): Promise<SlackEventResult> {
  const { store } = deps;
  const isProduction = deps.isProduction ?? isProductionRuntime;
  const signingSecret = process.env.SLACK_SIGNING_SECRET ?? "";

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(params.rawBody) as Record<string, unknown>;
  } catch {
    return { status: 400, body: "bad_request" };
  }

  const timestamp = params.headers["x-slack-request-timestamp"];
  const signature = params.headers["x-slack-signature"];
  const signatureOk = verifySlackSignature({
    signingSecret,
    timestamp,
    signature,
    rawBody: params.rawBody,
  });

  // URL verification handshake — echo the challenge (signed in production).
  if (body.type === "url_verification") {
    if (signingSecret && isProduction() && !signatureOk) {
      return { status: 401, body: "unauthorized" };
    }
    const challenge = typeof body.challenge === "string" ? body.challenge : "";
    return { status: 200, body: challenge, contentType: "text/plain" };
  }

  if (body.type !== "event_callback") return OK;

  // Slack retries on timeout; skip retries so we never double-reply.
  if (params.headers["x-slack-retry-num"]) return OK;

  const teamId = typeof body.team_id === "string" ? body.team_id : null;
  if (!teamId) return OK;
  const channel = await store.getEmployeeChannelBySlackTeam(teamId);
  if (!channel) {
    // Unknown workspace — ack so Slack stops retrying, record metadata only.
    await store.createChannelWebhookEvent({
      organizationId: null,
      channelId: null,
      providerType: "slack",
      eventType: "error",
      status: "ignored",
      metadata: { reason: "unknown_workspace" },
    });
    return OK;
  }

  const config = await resolveProviderConfig(store, channel, slackProvider);
  const request: WebhookRequest = {
    method: "POST",
    url: "",
    headers: params.headers,
    query: {},
    rawBody: params.rawBody,
    form: {},
    json: body,
  };

  // Verify the signature (allow simulated mode off-prod, mirroring messaging).
  const allowed = signatureOk || (config.mode !== "live" && !isProduction());
  if (!allowed) {
    await store.createChannelWebhookEvent({
      organizationId: channel.organizationId,
      channelId: channel.id,
      providerType: "slack",
      eventType: "error",
      status: "failed",
      errorCode: "unverified",
      metadata: { reason: "bad_signature" },
    });
    return { status: 401, body: "unauthorized" };
  }

  const inbound = slackProvider.parseInboundWebhook(request);
  if (!inbound) return OK;

  await handleInboundMessagingMessage(deps, { channel, provider: slackProvider, config, inbound });
  return OK;
}
