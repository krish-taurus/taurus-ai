/**
 * Messaging channel management service (Prompt 009) — server only.
 *
 * Create/configure WhatsApp/SMS/Email channels, save encrypted provider
 * credentials, and run simulated inbound messages. Metadata-only audit events;
 * secrets are encrypted and never returned. Generation reuses the Model Gateway.
 */

import type { AiEmployee, ChannelProviderType, ChannelType, EmployeeChannel } from "@/lib/db/types";
import type { DataStore } from "@/lib/db/store";
import { generatePublicKey } from "@/modules/channels/keys";
import { defaultAppearance } from "@/modules/channels/appearance";
import {
  encryptCredentials,
  isChannelEncryptionConfigured,
  lastFour,
} from "@/modules/channels/credentials";
import { providersForChannelType } from "@/modules/channels/messaging/catalog";
import { assertCanAddConnection } from "@/modules/billing/service";
import { getMessagingProvider } from "@/modules/channels/messaging/registry";
import {
  createMessagingChannelSchema,
  simulateInboundSchema,
  updateMessagingChannelSchema,
} from "@/modules/channels/messaging/schema";
import {
  handleInboundMessagingMessage,
  type MessagingRuntimeResult,
} from "@/modules/channels/messaging/runtime";
import type { ChatGateway } from "@/modules/employee-chat/service";
import type { MessagingInboundMessage } from "@/modules/channels/messaging/types";

export interface MessagingActor {
  organizationId: string;
  userId: string;
}

export class MessagingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MessagingValidationError";
  }
}

/** The secret fields expected per provider (used to validate + pick key_last_four). */
const PROVIDER_SECRET_FIELDS: Record<string, { required: string[]; primary: string }> = {
  twilio: { required: ["accountSid", "authToken"], primary: "authToken" },
  meta_whatsapp_cloud: { required: ["accessToken"], primary: "accessToken" },
  sendgrid: { required: ["apiKey"], primary: "apiKey" },
  mailgun: { required: ["apiKey"], primary: "apiKey" },
  custom_webhook: { required: [], primary: "apiKey" },
};

async function auditChannel(
  store: DataStore,
  actor: MessagingActor,
  channel: EmployeeChannel,
  action: string,
): Promise<void> {
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action,
    targetType: "employee_channel",
    targetId: channel.id,
    metadata: {
      employeeId: channel.employeeId,
      channelId: channel.id,
      channelType: channel.channelType,
      providerType: channel.channelProvider,
      status: channel.status,
    },
  });
}

/** Create a messaging channel (WhatsApp/SMS/Email) for an employee. */
export async function createMessagingChannel(
  store: DataStore,
  actor: MessagingActor,
  employee: AiEmployee,
  input: unknown,
): Promise<EmployeeChannel> {
  const parsed = createMessagingChannelSchema.safeParse(input);
  if (!parsed.success) {
    throw new MessagingValidationError(
      parsed.error.issues[0]?.message ?? "Please check the channel details.",
    );
  }
  const { channelType, provider, name, senderId } = parsed.data;
  if (!providersForChannelType(channelType).includes(provider)) {
    throw new MessagingValidationError("That provider does not support this channel.");
  }

  // Entitlement gate (Prompt 011): block past the plan's connection cap.
  await assertCanAddConnection(store, actor.organizationId);

  const channel = await store.createEmployeeChannel({
    organizationId: actor.organizationId,
    employeeId: employee.id,
    channelType,
    channelProvider: provider,
    publicKey: generatePublicKey(),
    name,
    status: "draft",
    allowedDomains: [],
    appearance: { ...defaultAppearance(employee), employeeDisplayName: employee.name },
    providerConfig: senderId ? { senderId } : {},
    welcomeMessage: null,
    createdByUserId: actor.userId,
  });
  await auditChannel(store, actor, channel, "messaging_channel.created");
  return channel;
}

/** Update a messaging channel's name and non-secret provider config. */
export async function updateMessagingChannel(
  store: DataStore,
  actor: MessagingActor,
  channelId: string,
  input: unknown,
): Promise<EmployeeChannel> {
  const parsed = updateMessagingChannelSchema.safeParse(input);
  if (!parsed.success) {
    throw new MessagingValidationError(
      parsed.error.issues[0]?.message ?? "Please check the channel details.",
    );
  }
  const current = await store.getEmployeeChannel(actor.organizationId, channelId);
  if (!current) throw new MessagingValidationError("Channel not found.");

  const providerConfig: Record<string, unknown> = { ...current.providerConfig };
  if (parsed.data.senderId) providerConfig.senderId = parsed.data.senderId;
  if (parsed.data.domain) providerConfig.domain = parsed.data.domain;

  const updated = await store.updateEmployeeChannel(actor.organizationId, channelId, {
    name: parsed.data.name,
    welcomeMessage: parsed.data.welcomeMessage || null,
    providerConfig,
  });
  if (!updated) throw new MessagingValidationError("Channel not found.");
  await auditChannel(store, actor, updated, "messaging_channel.updated");
  return updated;
}

async function messagingTransition(
  store: DataStore,
  actor: MessagingActor,
  channelId: string,
  op: "activate" | "pause" | "archive",
): Promise<EmployeeChannel> {
  const updated =
    op === "activate"
      ? await store.activateEmployeeChannel(actor.organizationId, channelId)
      : op === "pause"
        ? await store.pauseEmployeeChannel(actor.organizationId, channelId)
        : await store.archiveEmployeeChannel(actor.organizationId, channelId);
  if (!updated) throw new MessagingValidationError("Channel not found.");
  await auditChannel(
    store,
    actor,
    updated,
    op === "activate"
      ? "messaging_channel.activated"
      : op === "pause"
        ? "messaging_channel.paused"
        : "messaging_channel.archived",
  );
  return updated;
}

export function activateMessagingChannel(
  store: DataStore,
  actor: MessagingActor,
  channelId: string,
) {
  return messagingTransition(store, actor, channelId, "activate");
}
export function pauseMessagingChannel(store: DataStore, actor: MessagingActor, channelId: string) {
  return messagingTransition(store, actor, channelId, "pause");
}
export function archiveMessagingChannel(
  store: DataStore,
  actor: MessagingActor,
  channelId: string,
) {
  return messagingTransition(store, actor, channelId, "archive");
}

/** Save (encrypt) a bring-your-own-key credential bundle for a provider. */
export async function saveProviderCredential(
  store: DataStore,
  actor: MessagingActor,
  providerType: ChannelProviderType,
  secrets: Record<string, string>,
  label: string | null,
): Promise<void> {
  if (!isChannelEncryptionConfigured()) {
    throw new MessagingValidationError(
      "Secure credential storage is not configured, so your own key cannot be saved yet.",
    );
  }
  const spec = PROVIDER_SECRET_FIELDS[providerType];
  if (!spec) throw new MessagingValidationError("Unknown provider.");
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(secrets)) {
    if (typeof v === "string" && v.trim()) clean[k] = v.trim();
  }
  for (const field of spec.required) {
    if (!clean[field]) throw new MessagingValidationError(`Missing required credential: ${field}.`);
  }

  const encrypted = await encryptCredentials(JSON.stringify(clean));
  const primary = clean[spec.primary] ?? Object.values(clean)[0] ?? "";
  await store.createChannelProviderCredential({
    organizationId: actor.organizationId,
    providerType,
    credentialMode: "bring_your_own_key",
    encryptedCredentials: encrypted,
    credentialLabel: label,
    keyLastFour: primary ? lastFour(primary) : null,
    status: "active",
    userId: actor.userId,
  });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "channel_provider_credential.saved",
    targetType: "provider",
    // A provider is identified by its type (kept in metadata), not a UUID.
    // target_id is a uuid column, so it must stay null here.
    targetId: null,
    metadata: { providerType, credentialMode: "bring_your_own_key" },
  });
}

/** Disable + drop a provider credential. */
export async function disableProviderCredential(
  store: DataStore,
  actor: MessagingActor,
  providerType: ChannelProviderType,
): Promise<void> {
  await store.disableChannelProviderCredential(actor.organizationId, providerType, actor.userId);
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "channel_provider_credential.disabled",
    targetType: "provider",
    // A provider is identified by its type (kept in metadata), not a UUID.
    // target_id is a uuid column, so it must stay null here.
    targetId: null,
    metadata: { providerType },
  });
}

export interface SimulateDeps {
  store: DataStore;
  gateway: ChatGateway;
  isProduction?: () => boolean;
}

/**
 * Run a simulated inbound message through the full messaging runtime. Always uses
 * simulated mode so no real provider send happens, even if credentials exist.
 */
export async function simulateInboundMessage(
  deps: SimulateDeps,
  channel: EmployeeChannel,
  input: unknown,
): Promise<MessagingRuntimeResult> {
  const parsed = simulateInboundSchema.safeParse(input);
  if (!parsed.success) {
    throw new MessagingValidationError(
      parsed.error.issues[0]?.message ?? "Please check the simulated message.",
    );
  }
  const provider = getMessagingProvider(channel.channelProvider);
  if (!provider) throw new MessagingValidationError("This provider is not available.");

  const inbound: MessagingInboundMessage = {
    providerType: channel.channelProvider,
    channelType: channel.channelType,
    externalConversationId: parsed.data.from,
    externalMessageId: `sim_${Date.now()}`,
    senderExternalId: parsed.data.from,
    senderLabel: parsed.data.name || null,
    messageText: parsed.data.text,
    contentType: channel.channelType === "email" ? "email" : "text",
    receivedAt: null,
    metadata: { simulated: true },
  };

  return handleInboundMessagingMessage(deps, {
    channel,
    provider,
    // Force simulated so a live-credentialed channel never sends a real message
    // during a test.
    config: { mode: "simulated", secrets: {}, channelConfig: channel.providerConfig },
    inbound,
  });
}

/** Which channel type (if any) this provider serves — used for validation. */
export function providerServesChannelType(
  providerType: ChannelProviderType,
  channelType: ChannelType,
): boolean {
  return providersForChannelType(channelType).includes(providerType);
}
