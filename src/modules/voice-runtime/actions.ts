"use server";

/**
 * Voice channel server actions (Prompt 010).
 *
 * SECURITY: auth + organization resolved server-side; organizationId never comes
 * from the client. Managing Voice Channels + credentials requires owner/admin
 * (messaging_channel.manage); simulating calls requires channel.manage. Secrets
 * are encrypted in the service; no provider SDKs imported here.
 */

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { createLlmGateway } from "@/modules/model-gateway/credential-resolver";
import type { ChannelProviderType } from "@/lib/db/types";
import {
  activateVoiceChannel,
  archiveVoiceChannel,
  createVoiceChannel,
  pauseVoiceChannel,
  saveVoiceProviderCredential,
  updateVoiceChannel,
  type VoiceActor,
} from "@/modules/voice-runtime/service";
import {
  endSimulatedCall,
  sendSimulatedUtterance,
  startSimulatedCall,
} from "@/modules/voice-runtime/simulated-call";
import { simulateStartSchema, simulateUtteranceSchema } from "@/modules/voice-runtime/schema";

export interface VoiceActionState {
  error?: string;
  ok?: boolean;
  callSessionId?: string;
  greeting?: string;
  callerText?: string;
  replyText?: string;
  sources?: { name: string; type: string; preview: string }[];
  ended?: boolean;
}

const DENIED = "You do not have permission to manage Voice Channels in this organization.";

async function requireManage(): Promise<{ ok: true; actor: VoiceActor } | { ok: false }> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "messaging_channel.manage")) return { ok: false };
  return { ok: true, actor: { organizationId: organization.id, userId: user.id } };
}

async function requireTest(): Promise<{ ok: true; actor: VoiceActor } | { ok: false }> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "channel.manage")) return { ok: false };
  return { ok: true, actor: { organizationId: organization.id, userId: user.id } };
}

function revalidate(employeeId: string) {
  revalidatePath(`/dashboard/employees/${employeeId}/channels`);
  revalidatePath(`/dashboard/employees/${employeeId}/channels/voice`);
}

function readVoiceForm(formData: FormData) {
  return {
    name: formData.get("name"),
    provider: formData.get("provider"),
    phoneNumber: formData.get("phoneNumber") ?? "",
    phoneNumberLabel: formData.get("phoneNumberLabel") ?? "",
    welcomeMessage: formData.get("welcomeMessage") ?? "",
    voiceStyle: formData.get("voiceStyle"),
    sttProvider: formData.get("sttProvider"),
    ttsProvider: formData.get("ttsProvider"),
    recordingSetting: formData.get("recordingSetting"),
    transcriptSetting: formData.get("transcriptSetting"),
    businessHours: formData.get("businessHours") ?? "",
    escalationNote: formData.get("escalationNote") ?? "",
  };
}

export async function createVoiceChannelAction(
  _p: VoiceActionState,
  formData: FormData,
): Promise<VoiceActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };
  const employeeId = String(formData.get("employeeId") ?? "");
  const store = getStore();
  const employee = await store.getEmployee(ctx.actor.organizationId, employeeId);
  if (!employee) return { error: "This AI Employee could not be found." };
  try {
    await createVoiceChannel(store, ctx.actor, employee, readVoiceForm(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the Voice Channel." };
  }
  revalidate(employeeId);
  return { ok: true };
}

export async function updateVoiceChannelAction(
  _p: VoiceActionState,
  formData: FormData,
): Promise<VoiceActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };
  const employeeId = String(formData.get("employeeId") ?? "");
  const channelId = String(formData.get("channelId") ?? "");
  try {
    await updateVoiceChannel(getStore(), ctx.actor, channelId, readVoiceForm(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the Voice Channel." };
  }
  revalidate(employeeId);
  return { ok: true };
}

async function statusAction(
  formData: FormData,
  op: "activate" | "pause" | "archive",
): Promise<VoiceActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };
  const employeeId = String(formData.get("employeeId") ?? "");
  const channelId = String(formData.get("channelId") ?? "");
  try {
    if (op === "activate") await activateVoiceChannel(getStore(), ctx.actor, channelId);
    else if (op === "pause") await pauseVoiceChannel(getStore(), ctx.actor, channelId);
    else await archiveVoiceChannel(getStore(), ctx.actor, channelId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update the Voice Channel." };
  }
  revalidate(employeeId);
  return { ok: true };
}

export async function activateVoiceChannelAction(_p: VoiceActionState, f: FormData) {
  return statusAction(f, "activate");
}
export async function pauseVoiceChannelAction(_p: VoiceActionState, f: FormData) {
  return statusAction(f, "pause");
}
export async function archiveVoiceChannelAction(_p: VoiceActionState, f: FormData) {
  return statusAction(f, "archive");
}

const SECRET_FIELDS = ["accountSid", "authToken", "apiKey", "apiSecret", "publicKey"];

export async function saveVoiceCredentialAction(
  _p: VoiceActionState,
  formData: FormData,
): Promise<VoiceActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };
  const providerType = String(formData.get("providerType") ?? "") as ChannelProviderType;
  const employeeId = String(formData.get("employeeId") ?? "");
  const secrets: Record<string, string> = {};
  for (const field of SECRET_FIELDS) {
    const value = formData.get(field);
    if (typeof value === "string" && value.trim()) secrets[field] = value.trim();
  }
  const label = formData.get("credentialLabel") ? String(formData.get("credentialLabel")) : null;
  try {
    await saveVoiceProviderCredential(getStore(), ctx.actor, providerType, secrets, label);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the credential." };
  }
  revalidate(employeeId);
  return { ok: true };
}

// --- Simulate Phone Call ----------------------------------------------------

export async function simulateStartCallAction(
  _p: VoiceActionState,
  formData: FormData,
): Promise<VoiceActionState> {
  const ctx = await requireTest();
  if (!ctx.ok) return { error: "You do not have permission to test this channel." };
  const channelId = String(formData.get("channelId") ?? "");
  const store = getStore();
  const channel = await store.getEmployeeChannel(ctx.actor.organizationId, channelId);
  if (!channel) return { error: "Channel not found." };

  const parsed = simulateStartSchema.safeParse({
    from: formData.get("from"),
    name: formData.get("name") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the caller details." };
  }

  const result = await startSimulatedCall(
    { store, gateway: createLlmGateway(store) },
    { channel, from: parsed.data.from, name: parsed.data.name || null },
  );
  if (result.status !== "started" || !result.callSession) {
    return { error: `Call could not start (${result.reason ?? "unavailable"}).` };
  }
  return { ok: true, callSessionId: result.callSession.id, greeting: result.greeting };
}

export async function simulateUtteranceAction(
  _p: VoiceActionState,
  formData: FormData,
): Promise<VoiceActionState> {
  const ctx = await requireTest();
  if (!ctx.ok) return { error: "You do not have permission to test this channel." };
  const channelId = String(formData.get("channelId") ?? "");
  const store = getStore();
  const channel = await store.getEmployeeChannel(ctx.actor.organizationId, channelId);
  if (!channel) return { error: "Channel not found." };

  const parsed = simulateUtteranceSchema.safeParse({
    callSessionId: formData.get("callSessionId"),
    text: formData.get("text"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please enter a message." };
  }
  const callSession = await store.getVoiceCallSession(
    ctx.actor.organizationId,
    parsed.data.callSessionId,
  );
  if (!callSession) return { error: "Call not found." };
  const employee = await store.getEmployee(ctx.actor.organizationId, channel.employeeId);
  if (!employee) return { error: "Employee not found." };

  const result = await sendSimulatedUtterance(
    { store, gateway: createLlmGateway(store) },
    { channel, employee, callSession, text: parsed.data.text },
  );
  if (result.status !== "answered") {
    return { error: `The AI Employee couldn't respond (${result.reason ?? "unavailable"}).` };
  }
  return {
    ok: true,
    callSessionId: callSession.id,
    callerText: result.callerText,
    replyText: result.replyText,
    sources: result.sources,
  };
}

export async function simulateEndCallAction(
  _p: VoiceActionState,
  formData: FormData,
): Promise<VoiceActionState> {
  const ctx = await requireTest();
  if (!ctx.ok) return { error: "You do not have permission to test this channel." };
  const channelId = String(formData.get("channelId") ?? "");
  const callSessionId = String(formData.get("callSessionId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  const store = getStore();
  const channel = await store.getEmployeeChannel(ctx.actor.organizationId, channelId);
  if (!channel) return { error: "Channel not found." };
  const callSession = await store.getVoiceCallSession(ctx.actor.organizationId, callSessionId);
  if (!callSession) return { error: "Call not found." };

  await endSimulatedCall({ store, gateway: createLlmGateway(store) }, { channel, callSession });
  if (employeeId) revalidate(employeeId);
  return { ok: true, ended: true };
}
