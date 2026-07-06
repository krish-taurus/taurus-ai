"use server";

/**
 * Hiring Studio server action (Prompt 004).
 *
 * SECURITY: authentication + organization are resolved server-side via
 * requireCurrentOrganization(); the organizationId is never taken from the
 * client. The action re-checks the employee.create permission before hiring, so
 * client-side gating is never trusted on its own.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { hireEmployee, hireEmployeeSchema } from "@/modules/employees/hiring";

export interface HireActionState {
  error?: string;
}

export async function hireEmployeeAction(
  _prevState: HireActionState,
  formData: FormData,
): Promise<HireActionState> {
  const { user, organization, membership } = await requireCurrentOrganization();

  // Server-side permission re-check (least privilege).
  if (!hasPermission(membership.role, "employee.create")) {
    return { error: "You do not have permission to hire AI Employees in this organization." };
  }

  const parsed = hireEmployeeSchema.safeParse({
    template: formData.get("template") ?? undefined,
    name: formData.get("name"),
    roleTitle: formData.get("roleTitle"),
    department: formData.get("department") ?? undefined,
    description: formData.get("description") ?? undefined,
    // Responsibilities arrive as repeated form fields; blanks are dropped.
    responsibilities: formData
      .getAll("responsibilities")
      .map((r) => String(r).trim())
      .filter((r) => r.length > 0),
    tone: formData.get("tone"),
    formality: formData.get("formality"),
    riskLevel: formData.get("riskLevel"),
    escalation: formData.get("escalation"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please review the details and try again." };
  }

  let employeeId: string;
  try {
    const employee = await hireEmployee(
      getStore(),
      { organizationId: organization.id, userId: user.id },
      parsed.data,
    );
    employeeId = employee.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not hire the AI Employee." };
  }

  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard");
  redirect(`/dashboard/hire/success/${employeeId}`);
}
