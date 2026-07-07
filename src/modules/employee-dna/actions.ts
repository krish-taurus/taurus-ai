"use server";

/**
 * Employee DNA server actions (Prompt 005).
 *
 * SECURITY: authentication + organization are resolved server-side via
 * requireCurrentOrganization(); organizationId is never taken from the client.
 * Each action re-checks permissions and confirms the employee belongs to the
 * current organization before doing anything. Permissions:
 *   - save draft  -> employee_dna.edit  (owner / admin / builder)
 *   - publish     -> employee.manage    (owner / admin)
 *   - archive     -> employee.manage    (owner / admin)
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission, type Permission } from "@/modules/organizations/roles";
import { archiveDnaVersion, publishDna, saveDnaDraft } from "@/modules/employee-dna/service";

export interface DnaActionState {
  error?: string;
}

/** Resolve org + user, check permission, and confirm the employee is in the org. */
async function resolveDnaContext(employeeId: string, permission: Permission) {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, permission)) {
    return { ok: false as const, reason: "denied" as const, organization };
  }
  const employee = await getStore().getEmployee(organization.id, employeeId);
  if (!employee) {
    return { ok: false as const, reason: "not_found" as const, organization };
  }
  return { ok: true as const, user, organization, employee };
}

function parseDna(formData: FormData): unknown {
  try {
    return JSON.parse(String(formData.get("dna") ?? "{}"));
  } catch {
    return null;
  }
}

export async function saveDnaDraftAction(
  _prevState: DnaActionState,
  formData: FormData,
): Promise<DnaActionState> {
  const employeeId = String(formData.get("employeeId") ?? "");
  const ctx = await resolveDnaContext(employeeId, "employee_dna.edit");
  if (!ctx.ok) {
    return {
      error:
        ctx.reason === "denied"
          ? "You do not have permission to edit Employee DNA in this organization."
          : "This AI Employee could not be found.",
    };
  }

  try {
    await saveDnaDraft(
      getStore(),
      { organizationId: ctx.organization.id, userId: ctx.user.id },
      employeeId,
      parseDna(formData),
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the Employee DNA." };
  }

  revalidatePath(`/dashboard/employees/${employeeId}`);
  revalidatePath(`/dashboard/employees/${employeeId}/dna`);
  redirect(`/dashboard/employees/${employeeId}/dna?saved=1`);
}

export async function publishDnaAction(
  _prevState: DnaActionState,
  formData: FormData,
): Promise<DnaActionState> {
  const employeeId = String(formData.get("employeeId") ?? "");
  const ctx = await resolveDnaContext(employeeId, "employee.manage");
  if (!ctx.ok) {
    return {
      error:
        ctx.reason === "denied"
          ? "You do not have permission to publish Employee DNA in this organization."
          : "This AI Employee could not be found.",
    };
  }

  try {
    await publishDna(
      getStore(),
      { organizationId: ctx.organization.id, userId: ctx.user.id },
      employeeId,
      parseDna(formData),
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not publish the Employee DNA." };
  }

  revalidatePath(`/dashboard/employees/${employeeId}`);
  revalidatePath(`/dashboard/employees/${employeeId}/dna`);
  redirect(`/dashboard/employees/${employeeId}/dna?published=1`);
}

export async function archiveDnaVersionAction(
  _prevState: DnaActionState,
  formData: FormData,
): Promise<DnaActionState> {
  const employeeId = String(formData.get("employeeId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  const ctx = await resolveDnaContext(employeeId, "employee.manage");
  if (!ctx.ok) {
    return {
      error:
        ctx.reason === "not_found"
          ? "This AI Employee could not be found."
          : "You do not have permission to archive Employee DNA versions.",
    };
  }

  try {
    await archiveDnaVersion(
      getStore(),
      { organizationId: ctx.organization.id, userId: ctx.user.id },
      employeeId,
      versionId,
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not archive this version." };
  }

  revalidatePath(`/dashboard/employees/${employeeId}/dna`);
  redirect(`/dashboard/employees/${employeeId}/dna`);
}
