"use server";

/**
 * Channel dashboard server actions (Prompt 008).
 *
 * SECURITY: authentication + organization resolved server-side via
 * requireCurrentOrganization(); organizationId is never taken from the client.
 * Every action re-checks the channel.manage permission and loads the employee
 * organization-scoped. No provider secrets are handled here.
 */

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import {
  activateChannel,
  archiveChannel,
  createWebChannel,
  pauseChannel,
  updateChannel,
  type ChannelActor,
} from "@/modules/channels/service";
import { parseDomains } from "@/modules/channels/schema";

export interface ChannelActionState {
  error?: string;
  ok?: boolean;
}

const DENIED = "You do not have permission to manage channels in this organization.";

async function requireManage(): Promise<{ ok: true; actor: ChannelActor } | { ok: false }> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "channel.manage")) return { ok: false };
  return { ok: true, actor: { organizationId: organization.id, userId: user.id } };
}

export async function createWebChannelAction(
  _prevState: ChannelActionState,
  formData: FormData,
): Promise<ChannelActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  const employeeId = String(formData.get("employeeId") ?? "");
  const store = getStore();
  const employee = await store.getEmployee(ctx.actor.organizationId, employeeId);
  if (!employee) return { error: "This AI Employee could not be found." };

  try {
    await createWebChannel(store, ctx.actor, employee, {
      name: formData.get("name") ?? "Website",
      welcomeMessage: formData.get("welcomeMessage") ?? undefined,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the channel." };
  }

  revalidatePath(`/dashboard/employees/${employeeId}/channels`);
  return { ok: true };
}

export async function updateChannelAction(
  _prevState: ChannelActionState,
  formData: FormData,
): Promise<ChannelActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  const employeeId = String(formData.get("employeeId") ?? "");
  const channelId = String(formData.get("channelId") ?? "");

  try {
    await updateChannel(getStore(), ctx.actor, channelId, {
      name: formData.get("name"),
      welcomeMessage: formData.get("welcomeMessage") ?? "",
      allowedDomains: parseDomains(String(formData.get("allowedDomains") ?? "")),
      appearance: {
        theme: formData.get("theme") === "light" ? "light" : "dark",
        position: formData.get("position") === "bottom-left" ? "bottom-left" : "bottom-right",
        launcherLabel: String(formData.get("launcherLabel") ?? "Chat with us"),
        employeeDisplayName: String(formData.get("employeeDisplayName") ?? ""),
        accentStyle: formData.get("accentStyle") === "solid" ? "solid" : "mono",
        showSources: formData.get("showSources") === "on",
        collectVisitorEmail: formData.get("collectVisitorEmail") === "on",
        brandName: formData.get("brandName") ? String(formData.get("brandName")) : null,
      },
      rateLimitPerMinute: formData.get("rateLimitPerMinute") ?? 20,
      rateLimitPerDay: formData.get("rateLimitPerDay") ?? 500,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the channel." };
  }

  revalidatePath(`/dashboard/employees/${employeeId}/channels`);
  return { ok: true };
}

async function channelStatusAction(
  formData: FormData,
  op: "activate" | "pause" | "archive",
): Promise<ChannelActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  const employeeId = String(formData.get("employeeId") ?? "");
  const channelId = String(formData.get("channelId") ?? "");

  try {
    if (op === "activate") await activateChannel(getStore(), ctx.actor, channelId);
    else if (op === "pause") await pauseChannel(getStore(), ctx.actor, channelId);
    else await archiveChannel(getStore(), ctx.actor, channelId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update the channel." };
  }

  revalidatePath(`/dashboard/employees/${employeeId}/channels`);
  return { ok: true };
}

export async function activateChannelAction(
  _prevState: ChannelActionState,
  formData: FormData,
): Promise<ChannelActionState> {
  return channelStatusAction(formData, "activate");
}

export async function pauseChannelAction(
  _prevState: ChannelActionState,
  formData: FormData,
): Promise<ChannelActionState> {
  return channelStatusAction(formData, "pause");
}

export async function archiveChannelAction(
  _prevState: ChannelActionState,
  formData: FormData,
): Promise<ChannelActionState> {
  return channelStatusAction(formData, "archive");
}
