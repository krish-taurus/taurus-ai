/**
 * Voice channel management service (Prompt 010) — server only.
 *
 * Create/configure Voice Channels, phone numbers, and encrypted provider
 * credentials. Metadata-only audit events; secrets are encrypted and never
 * returned. Reasoning happens through the Employee Chat Runtime (see runtime.ts).
 */

import type {
  AiEmployee,
  ChannelProviderType,
  EmployeeChannel,
  VoicePhoneNumber,
} from "@/lib/db/types";
import type { DataStore } from "@/lib/db/store";
import { generatePublicKey } from "@/modules/channels/keys";
import { defaultAppearance } from "@/modules/channels/appearance";
import {
  encryptCredentials,
  isChannelEncryptionConfigured,
  lastFour,
} from "@/modules/channels/credentials";
import { createVoiceChannelSchema, updateVoiceChannelSchema } from "@/modules/voice-runtime/schema";
import { defaultVoiceConfig, type VoiceChannelConfig } from "@/modules/voice-runtime/catalog";

export interface VoiceActor {
  organizationId: string;
  userId: string;
}

export class VoiceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VoiceValidationError";
  }
}

const PROVIDER_SECRET_FIELDS: Partial<
  Record<ChannelProviderType, { required: string[]; primary: string }>
> = {
  twilio_voice: { required: ["accountSid", "authToken"], primary: "authToken" },
  telnyx_voice: { required: ["apiKey"], primary: "apiKey" },
  vonage_voice: { required: ["apiKey", "apiSecret"], primary: "apiSecret" },
};

async function auditChannel(
  store: DataStore,
  actor: VoiceActor,
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

function voiceConfigFrom(values: {
  voiceStyle: VoiceChannelConfig["voiceStyle"];
  sttProvider: string;
  ttsProvider: string;
  recordingSetting: VoiceChannelConfig["recordingSetting"];
  transcriptSetting: VoiceChannelConfig["transcriptSetting"];
  businessHours?: string;
  escalationNote?: string;
}): VoiceChannelConfig {
  return {
    ...defaultVoiceConfig(),
    voiceStyle: values.voiceStyle,
    sttProvider: values.sttProvider || "simulated_stt",
    ttsProvider: values.ttsProvider || "simulated_tts",
    recordingSetting: values.recordingSetting,
    transcriptSetting: values.transcriptSetting,
    businessHours: values.businessHours || null,
    escalationNote: values.escalationNote || null,
  };
}

/** Create the phone_call channel for an employee (+ an optional phone number). */
export async function createVoiceChannel(
  store: DataStore,
  actor: VoiceActor,
  employee: AiEmployee,
  input: unknown,
): Promise<EmployeeChannel> {
  const parsed = createVoiceChannelSchema.safeParse(input);
  if (!parsed.success) {
    throw new VoiceValidationError(
      parsed.error.issues[0]?.message ?? "Please check the channel details.",
    );
  }
  const values = parsed.data;

  const channel = await store.createEmployeeChannel({
    organizationId: actor.organizationId,
    employeeId: employee.id,
    channelType: "phone_call",
    channelProvider: values.provider,
    publicKey: generatePublicKey(),
    name: values.name,
    status: "draft",
    allowedDomains: [],
    appearance: { ...defaultAppearance(employee), employeeDisplayName: employee.name },
    providerConfig: voiceConfigFrom(values) as unknown as Record<string, unknown>,
    welcomeMessage: values.welcomeMessage || null,
    createdByUserId: actor.userId,
  });
  await auditChannel(store, actor, channel, "voice_channel.created");

  if (values.phoneNumber) {
    await addOrUpdatePhoneNumber(store, actor, channel, {
      phoneNumber: values.phoneNumber,
      label: values.phoneNumberLabel || null,
    });
  }
  return channel;
}

/** Update the voice channel name, welcome, config, and phone number. */
export async function updateVoiceChannel(
  store: DataStore,
  actor: VoiceActor,
  channelId: string,
  input: unknown,
): Promise<EmployeeChannel> {
  const parsed = updateVoiceChannelSchema.safeParse(input);
  if (!parsed.success) {
    throw new VoiceValidationError(
      parsed.error.issues[0]?.message ?? "Please check the channel details.",
    );
  }
  const values = parsed.data;
  const current = await store.getEmployeeChannel(actor.organizationId, channelId);
  if (!current) throw new VoiceValidationError("Channel not found.");

  const updated = await store.updateEmployeeChannel(actor.organizationId, channelId, {
    name: values.name,
    welcomeMessage: values.welcomeMessage || null,
    providerConfig: voiceConfigFrom(values) as unknown as Record<string, unknown>,
  });
  if (!updated) throw new VoiceValidationError("Channel not found.");
  await auditChannel(store, actor, updated, "voice_channel.updated");

  if (values.phoneNumber) {
    await addOrUpdatePhoneNumber(store, actor, updated, {
      phoneNumber: values.phoneNumber,
      label: values.phoneNumberLabel || null,
    });
  }
  return updated;
}

/** Create or update the channel's primary phone number. */
export async function addOrUpdatePhoneNumber(
  store: DataStore,
  actor: VoiceActor,
  channel: EmployeeChannel,
  input: { phoneNumber: string; label: string | null; countryCode?: string | null },
): Promise<VoicePhoneNumber> {
  const existing = (
    await store.listVoicePhoneNumbersForChannel(actor.organizationId, channel.id)
  )[0];
  if (existing) {
    const updated = await store.updateVoicePhoneNumber(actor.organizationId, existing.id, {
      phoneNumber: input.phoneNumber,
      displayLabel: input.label,
      countryCode: input.countryCode ?? existing.countryCode,
    });
    if (updated) {
      await store.createAuditEvent({
        organizationId: actor.organizationId,
        actorType: "user",
        actorId: actor.userId,
        action: "voice_phone_number.updated",
        targetType: "voice_phone_number",
        targetId: updated.id,
        metadata: { channelId: channel.id, phoneNumberId: updated.id },
      });
      return updated;
    }
  }
  const created = await store.createVoicePhoneNumber({
    organizationId: actor.organizationId,
    channelId: channel.id,
    providerType: channel.channelProvider,
    phoneNumber: input.phoneNumber,
    displayLabel: input.label,
    countryCode: input.countryCode ?? null,
    capabilities: { voice: true },
    status: "active",
    createdByUserId: actor.userId,
  });
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "voice_phone_number.created",
    targetType: "voice_phone_number",
    targetId: created.id,
    metadata: { channelId: channel.id, phoneNumberId: created.id },
  });
  return created;
}

async function transition(
  store: DataStore,
  actor: VoiceActor,
  channelId: string,
  op: "activate" | "pause" | "archive",
): Promise<EmployeeChannel> {
  const updated =
    op === "activate"
      ? await store.activateEmployeeChannel(actor.organizationId, channelId)
      : op === "pause"
        ? await store.pauseEmployeeChannel(actor.organizationId, channelId)
        : await store.archiveEmployeeChannel(actor.organizationId, channelId);
  if (!updated) throw new VoiceValidationError("Channel not found.");
  await auditChannel(
    store,
    actor,
    updated,
    op === "activate"
      ? "voice_channel.activated"
      : op === "pause"
        ? "voice_channel.paused"
        : "voice_channel.archived",
  );
  return updated;
}

export function activateVoiceChannel(store: DataStore, actor: VoiceActor, channelId: string) {
  return transition(store, actor, channelId, "activate");
}
export function pauseVoiceChannel(store: DataStore, actor: VoiceActor, channelId: string) {
  return transition(store, actor, channelId, "pause");
}
export function archiveVoiceChannel(store: DataStore, actor: VoiceActor, channelId: string) {
  return transition(store, actor, channelId, "archive");
}

/** Save (encrypt) a bring-your-own-key credential bundle for a voice provider. */
export async function saveVoiceProviderCredential(
  store: DataStore,
  actor: VoiceActor,
  providerType: ChannelProviderType,
  secrets: Record<string, string>,
  label: string | null,
): Promise<void> {
  if (!isChannelEncryptionConfigured()) {
    throw new VoiceValidationError(
      "Secure credential storage is not configured, so your own key cannot be saved yet.",
    );
  }
  const spec = PROVIDER_SECRET_FIELDS[providerType];
  if (!spec) throw new VoiceValidationError("This provider does not take credentials.");
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(secrets)) {
    if (typeof v === "string" && v.trim()) clean[k] = v.trim();
  }
  for (const field of spec.required) {
    if (!clean[field]) throw new VoiceValidationError(`Missing required credential: ${field}.`);
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
