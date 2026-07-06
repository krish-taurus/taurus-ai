"use server";

/**
 * AI Employee server actions (Prompt 003).
 *
 * SECURITY: the organization is ALWAYS resolved server-side via
 * requireCurrentOrganization() (which validates active membership). No action
 * trusts an organizationId from the client. Each action also checks the caller's
 * role permission before mutating, and every mutation is organization-scoped.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission, type Permission } from "@/modules/organizations/roles";
import {
  archiveEmployee,
  activateEmployee,
  createEmployeeForOrganization,
  createEmployeeSchema,
  pauseEmployee,
  updateEmployeeProfile,
  updateEmployeeSchema,
} from "@/modules/employees/service";

export interface EmployeeActionState {
  error?: string;
}

/** Resolve the current org + user and assert the given permission. */
async function requirePermission(permission: Permission) {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, permission)) {
    return { denied: true as const, user, organization };
  }
  return { denied: false as const, user, organization };
}

export async function createEmployeeAction(
  _prevState: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  const ctx = await requirePermission("employee.create");
  if (ctx.denied) {
    return { error: "You do not have permission to hire AI Employees in this organization." };
  }

  const parsed = createEmployeeSchema.safeParse({
    name: formData.get("name"),
    roleTitle: formData.get("roleTitle"),
    department: formData.get("department") ?? undefined,
    description: formData.get("description") ?? undefined,
    template: formData.get("template") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  let employeeId: string;
  try {
    const employee = await createEmployeeForOrganization(
      getStore(),
      { organizationId: ctx.organization.id, userId: ctx.user.id },
      parsed.data,
    );
    employeeId = employee.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create the AI Employee." };
  }

  revalidatePath("/dashboard/employees");
  redirect(`/dashboard/employees/${employeeId}`);
}

export async function updateEmployeeAction(
  _prevState: EmployeeActionState,
  formData: FormData,
): Promise<EmployeeActionState> {
  const employeeId = String(formData.get("employeeId") ?? "");
  const ctx = await requirePermission("employee.manage");
  if (ctx.denied) {
    return { error: "You do not have permission to edit AI Employees in this organization." };
  }

  const parsed = updateEmployeeSchema.safeParse({
    name: formData.get("name"),
    roleTitle: formData.get("roleTitle"),
    department: formData.get("department") ?? undefined,
    description: formData.get("description") ?? undefined,
    status: formData.get("status"),
    visibility: formData.get("visibility"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  try {
    await updateEmployeeProfile(
      getStore(),
      { organizationId: ctx.organization.id, userId: ctx.user.id },
      employeeId,
      parsed.data,
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not update the AI Employee." };
  }

  revalidatePath("/dashboard/employees");
  revalidatePath(`/dashboard/employees/${employeeId}`);
  redirect(`/dashboard/employees/${employeeId}`);
}

/** Quick lifecycle actions (buttons on the detail page). */
async function runLifecycle(
  formData: FormData,
  run: (
    store: ReturnType<typeof getStore>,
    actor: { organizationId: string; userId: string },
    employeeId: string,
  ) => Promise<unknown>,
): Promise<void> {
  const employeeId = String(formData.get("employeeId") ?? "");
  const ctx = await requirePermission("employee.manage");
  if (ctx.denied) redirect(`/dashboard/employees/${employeeId}`);

  try {
    await run(getStore(), { organizationId: ctx.organization.id, userId: ctx.user.id }, employeeId);
  } catch {
    // Fall through to a redirect; the detail page will reflect current state.
  }

  revalidatePath("/dashboard/employees");
  revalidatePath(`/dashboard/employees/${employeeId}`);
  redirect(`/dashboard/employees/${employeeId}`);
}

export async function pauseEmployeeAction(formData: FormData): Promise<void> {
  await runLifecycle(formData, pauseEmployee);
}

export async function activateEmployeeAction(formData: FormData): Promise<void> {
  await runLifecycle(formData, activateEmployee);
}

export async function archiveEmployeeAction(formData: FormData): Promise<void> {
  const employeeId = String(formData.get("employeeId") ?? "");
  const ctx = await requirePermission("employee.manage");
  if (ctx.denied) redirect(`/dashboard/employees/${employeeId}`);

  try {
    await archiveEmployee(
      getStore(),
      { organizationId: ctx.organization.id, userId: ctx.user.id },
      employeeId,
    );
  } catch {
    // Ignore and redirect to the list below.
  }

  revalidatePath("/dashboard/employees");
  redirect("/dashboard/employees");
}
