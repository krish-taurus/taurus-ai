"use server";

/**
 * Microsoft Teams connect action (Sprint 043).
 *
 * SECURITY: authentication + organization are resolved server-side; the AAD app
 * secret is stored encrypted and never returned to the client. Requires the
 * messaging-channel manage permission.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { connectTeams } from "@/modules/channels/teams/service";

export interface TeamsActionState {
  error?: string;
}

export async function connectTeamsAction(
  _prev: TeamsActionState,
  formData: FormData,
): Promise<TeamsActionState> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "messaging_channel.manage")) {
    return { error: "You do not have permission to connect Teams." };
  }

  const employeeId = String(formData.get("employeeId") ?? "");
  const appId = String(formData.get("appId") ?? "").trim();
  const appPassword = String(formData.get("appPassword") ?? "").trim();
  const tenantId = String(formData.get("tenantId") ?? "").trim();
  const tenantName = String(formData.get("tenantName") ?? "").trim() || null;

  if (!appId || !appPassword || !tenantId) {
    return { error: "Enter the App ID, client secret, and tenant ID." };
  }

  const store = getStore();
  const employee = await store.getEmployee(organization.id, employeeId);
  if (!employee) return { error: "This AI Employee could not be found." };

  try {
    await connectTeams(
      store,
      { organizationId: organization.id, userId: user.id },
      { employee, appId, appPassword, tenantId, tenantName },
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not connect Teams." };
  }

  revalidatePath(`/dashboard/employees/${employeeId}/channels/teams`);
  redirect(`/dashboard/employees/${employeeId}/channels/teams?connected=1`);
}
