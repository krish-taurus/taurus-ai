"use server";

/**
 * Messaging channel server actions (Prompt 009).
 *
 * SECURITY: auth + organization resolved server-side; organizationId never comes
 * from the client. Managing messaging channels + credentials requires owner/admin
 * (messaging_channel.manage); simulated testing requires channel.manage. Secrets
 * are encrypted in the service and never returned. No provider SDKs imported here.
 */

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { createLlmGateway } from "@/modules/model-gateway/credential-resolver";
import type { ChannelProviderType } from "@/lib/db/types";
import {
  activateMessagingChannel,
  archiveMessagingChannel,
  createMessagingChannel,
  disableProviderCredential,
  pauseMessagingChannel,
  saveProviderCredential,
  simulateInboundMessage,
  updateMessagingChannel,
  type MessagingActor,
} from "@/modules/channels/messaging/service";

export interface MessagingActionState {
  error?: string;
  ok?: boolean;
  note?: string;
}

const DENIED = "You do not have permission to manage messaging channels in this organization.";

async function requireManage(): Promise<{ ok: true; actor: MessagingActor } | { ok: false }> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "messaging_channel.manage")) return { ok: false };
  return { ok: true, actor: { organizationId: organization.id, userId: user.id } };
}

async function requireTest(): Promise<{ ok: true; actor: MessagingActor } | { ok: false }> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "channel.manage")) return { ok: false };
  return { ok: true, actor: { organizationId: organization.id, userId: user.id } };
}

function revalidate(employeeId: string, channelType?: string) {
  revalidatePath(`/dashboard/employees/${employeeId}/channels`);
  if (channelType) {
    revalidatePath(`/dashboard/employees/${employeeId}/channels/messaging/${channelType}`);
  }
}

export async function createMessagingChannelAction(
  _prev: MessagingActionState,
  formData: FormData,
): Promise<MessagingActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  const employeeId = String(formData.get("employeeId") ?? "");
  const store = getStore();
  const employee = await store.getEmployee(ctx.actor.organizationId, employeeId);
  if (!employee) return { error: "This AI Employee could not be found." };

  try {
    await createMessagingChannel(store, ctx.actor, employee, {
      channelType: formData.get("channelType"),
      provider: formData.get("provider"),
      name: formData.get("name"),
      senderId: formData.get("senderId") ?? "",
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the channel." };
  }
  revalidate(employeeId, String(formData.get("channelType") ?? ""));
  return { ok: true };
}

export async function updateMessagingChannelAction(
  _prev: MessagingActionState,
  formData: FormData,
): Promise<MessagingActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  const employeeId = String(formData.get("employeeId") ?? "");
  const channelId = String(formData.get("channelId") ?? "");
  try {
    await updateMessagingChannel(getStore(), ctx.actor, channelId, {
      name: formData.get("name"),
      senderId: formData.get("senderId") ?? "",
      domain: formData.get("domain") ?? "",
      welcomeMessage: formData.get("welcomeMessage") ?? "",
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the channel." };
  }
  revalidate(employeeId, String(formData.get("channelType") ?? ""));
  return { ok: true };
}

async function statusAction(
  formData: FormData,
  op: "activate" | "pause" | "archive",
): Promise<MessagingActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };
  const employeeId = String(formData.get("employeeId") ?? "");
  const channelId = String(formData.get("channelId") ?? "");
  try {
    if (op === "activate") await activateMessagingChannel(getStore(), ctx.actor, channelId);
    else if (op === "pause") await pauseMessagingChannel(getStore(), ctx.actor, channelId);
    else await archiveMessagingChannel(getStore(), ctx.actor, channelId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update the channel." };
  }
  revalidate(employeeId, String(formData.get("channelType") ?? ""));
  return { ok: true };
}

export async function activateMessagingChannelAction(
  _p: MessagingActionState,
  formData: FormData,
): Promise<MessagingActionState> {
  return statusAction(formData, "activate");
}
export async function pauseMessagingChannelAction(
  _p: MessagingActionState,
  formData: FormData,
): Promise<MessagingActionState> {
  return statusAction(formData, "pause");
}
export async function archiveMessagingChannelAction(
  _p: MessagingActionState,
  formData: FormData,
): Promise<MessagingActionState> {
  return statusAction(formData, "archive");
}

const SECRET_FIELDS = [
  "accountSid",
  "authToken",
  "messagingServiceSid",
  "accessToken",
  "phoneNumberId",
  "appSecret",
  "verifyToken",
  "apiKey",
  "domain",
  "signingKey",
  // SendGrid Signed Event Webhook verification key (ECDSA public key).
  "verificationKey",
];

export async function saveProviderCredentialAction(
  _p: MessagingActionState,
  formData: FormData,
): Promise<MessagingActionState> {
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
    await saveProviderCredential(getStore(), ctx.actor, providerType, secrets, label);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the credential." };
  }
  revalidate(employeeId, String(formData.get("channelType") ?? ""));
  return { ok: true };
}

export async function disableProviderCredentialAction(
  _p: MessagingActionState,
  formData: FormData,
): Promise<MessagingActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };
  const providerType = String(formData.get("providerType") ?? "") as ChannelProviderType;
  const employeeId = String(formData.get("employeeId") ?? "");
  try {
    await disableProviderCredential(getStore(), ctx.actor, providerType);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not disable the credential." };
  }
  revalidate(employeeId, String(formData.get("channelType") ?? ""));
  return { ok: true };
}

export async function simulateInboundAction(
  _p: MessagingActionState,
  formData: FormData,
): Promise<MessagingActionState> {
  const ctx = await requireTest();
  if (!ctx.ok) return { error: "You do not have permission to test this channel." };

  const employeeId = String(formData.get("employeeId") ?? "");
  const channelId = String(formData.get("channelId") ?? "");
  const store = getStore();
  const channel = await store.getEmployeeChannel(ctx.actor.organizationId, channelId);
  if (!channel) return { error: "Channel not found." };

  let note = "";
  try {
    const result = await simulateInboundMessage(
      { store, gateway: createLlmGateway(store) },
      channel,
      {
        from: formData.get("from"),
        text: formData.get("text"),
        name: formData.get("name") ?? "",
      },
    );
    note =
      result.status === "processed"
        ? "Simulated message processed — a reply was generated."
        : `Message was not processed (${result.reason ?? "unavailable"}).`;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not simulate the message." };
  }
  revalidate(employeeId, channel.channelType);
  return { ok: true, note };
}
