/**
 * Hiring Studio logic (Prompt 004).
 *
 * Pure, organization-scoped business logic for hiring an AI Employee through the
 * guided flow. No Next.js here, so it is unit-testable. The server action wraps
 * this with the authenticated user + resolved organization + permission checks.
 *
 * Hiring an employee creates the AiEmployee (status `draft`, visibility
 * `private`) with its responsibilities and working style, and records an
 * `employee.created` audit event with minimal, non-sensitive metadata.
 */

import { z } from "zod";
import type { DataStore } from "@/lib/db/store";
import type {
  AiEmployee,
  EmployeeEscalation,
  EmployeeFormality,
  EmployeeRiskLevel,
  EmployeeTone,
} from "@/lib/db/types";
import type { EmployeeActor } from "@/modules/employees/service";
import {
  ESCALATION_OPTIONS,
  FORMALITY_OPTIONS,
  HIRING_TEMPLATE_KEYS,
  RISK_OPTIONS,
  TONE_OPTIONS,
} from "@/modules/employees/hiring-templates";
import { assertCanHireEmployee } from "@/modules/billing/service";
import { DEFAULT_EMPLOYEE_MODEL_ID } from "@/modules/usage/model-pricing";

const responsibilitySchema = z.string().trim().min(1).max(200);

export const hireEmployeeSchema = z.object({
  template: z.enum(HIRING_TEMPLATE_KEYS as [string, ...string[]]).optional(),
  name: z.string().trim().min(2, "Please enter a name (at least 2 characters).").max(120),
  roleTitle: z.string().trim().min(2, "Please enter a role title.").max(120),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  responsibilities: z
    .array(responsibilitySchema)
    .max(20, "That is a lot of responsibilities — please keep it under 20.")
    .default([]),
  tone: z.enum(TONE_OPTIONS as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "Please choose a tone." }),
  }),
  formality: z.enum(FORMALITY_OPTIONS as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "Please choose a formality." }),
  }),
  riskLevel: z.enum(RISK_OPTIONS as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "Please choose a risk level." }),
  }),
  escalation: z.enum(ESCALATION_OPTIONS as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "Please choose an escalation preference." }),
  }),
});

export type HireEmployeeValues = z.infer<typeof hireEmployeeSchema>;

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Hire an AI Employee within an organization. Validates input, creates the
 * employee, and records the audit event. Returns the created employee.
 */
export async function hireEmployee(
  store: DataStore,
  actor: EmployeeActor,
  input: HireEmployeeValues,
): Promise<AiEmployee> {
  const values = hireEmployeeSchema.parse(input);

  // Entitlement gate (Sprint 015): block hiring past the plan's AI Employee cap.
  // Re-checked server-side; a clear upgrade message surfaces on limit.
  await assertCanHireEmployee(store, actor.organizationId);

  const employee = await store.createEmployee({
    organizationId: actor.organizationId,
    name: values.name,
    roleTitle: values.roleTitle,
    department: emptyToNull(values.department),
    description: emptyToNull(values.description),
    status: "draft",
    visibility: "private",
    responsibilities: values.responsibilities,
    workingStyle: {
      tone: values.tone as EmployeeTone,
      formality: values.formality as EmployeeFormality,
      riskLevel: values.riskLevel as EmployeeRiskLevel,
      escalation: values.escalation as EmployeeEscalation,
    },
    createdBy: actor.userId,
  });

  // Margin guardrail (Sprint 016): a new AI Employee starts on a budget-tier
  // model. Owners/admins can switch to a Standard/Premium model later (Model Hub);
  // this only sets the safe default so a flat plan starts cheap to serve.
  await store.updateEmployeeModelSettings(actor.organizationId, employee.id, {
    modelId: DEFAULT_EMPLOYEE_MODEL_ID,
    routingMode: "manual",
    updatedByUserId: actor.userId,
  });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "employee.created",
    targetType: "employee",
    targetId: employee.id,
    // Minimal, non-sensitive metadata only.
    metadata: {
      name: employee.name,
      roleTitle: employee.roleTitle,
      template: values.template ?? "custom",
      hiredVia: "hiring_studio",
    },
  });

  return employee;
}
