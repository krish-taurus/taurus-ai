/**
 * AI Employee service (Prompt 003).
 *
 * Pure business logic over a DataStore — no Next.js — so it is unit-testable.
 * The server actions wrap these with the authenticated user + resolved
 * organization. Every function is organization-scoped: the caller must pass an
 * organizationId that has already been validated against the user's membership.
 *
 * Audit events written here: employee.created, employee.updated, employee.paused,
 * employee.archived.
 */

import { z } from "zod";
import type { DataStore } from "@/lib/db/store";
import type { AiEmployee } from "@/lib/db/types";
import { EMPLOYEE_STATUSES, EMPLOYEE_TEMPLATE_KEYS, EMPLOYEE_VISIBILITIES } from "./metadata";

const nameSchema = z.string().trim().min(2, "Name must be at least 2 characters.").max(120);
const roleTitleSchema = z
  .string()
  .trim()
  .min(2, "Role title must be at least 2 characters.")
  .max(120);
const departmentSchema = z.string().trim().max(120).optional().or(z.literal(""));
const descriptionSchema = z.string().trim().max(2000).optional().or(z.literal(""));

export const createEmployeeSchema = z.object({
  name: nameSchema,
  roleTitle: roleTitleSchema,
  department: departmentSchema,
  description: descriptionSchema,
  template: z.enum(EMPLOYEE_TEMPLATE_KEYS as [string, ...string[]]).optional(),
});

export const updateEmployeeSchema = z.object({
  name: nameSchema,
  roleTitle: roleTitleSchema,
  department: departmentSchema,
  description: descriptionSchema,
  status: z.enum(EMPLOYEE_STATUSES as unknown as [string, ...string[]]),
  visibility: z.enum(EMPLOYEE_VISIBILITIES as unknown as [string, ...string[]]),
});

export type CreateEmployeeValues = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeValues = z.infer<typeof updateEmployeeSchema>;

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export interface EmployeeActor {
  organizationId: string;
  userId: string;
}

/** Create an AI Employee in an organization and record an audit event. */
export async function createEmployeeForOrganization(
  store: DataStore,
  actor: EmployeeActor,
  input: CreateEmployeeValues,
): Promise<AiEmployee> {
  const values = createEmployeeSchema.parse(input);

  const employee = await store.createEmployee({
    organizationId: actor.organizationId,
    name: values.name,
    roleTitle: values.roleTitle,
    department: emptyToNull(values.department),
    description: emptyToNull(values.description),
    status: "draft",
    visibility: "private",
    createdBy: actor.userId,
  });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "employee.created",
    targetType: "employee",
    targetId: employee.id,
    metadata: { name: employee.name, template: values.template ?? "custom" },
  });

  return employee;
}

/** The employee could not be found within the caller's organization. */
export class EmployeeNotFoundError extends Error {
  constructor(message = "This AI Employee could not be found.") {
    super(message);
    this.name = "EmployeeNotFoundError";
  }
}

/** Update an employee's editable profile fields; records employee.updated. */
export async function updateEmployeeProfile(
  store: DataStore,
  actor: EmployeeActor,
  employeeId: string,
  input: UpdateEmployeeValues,
): Promise<AiEmployee> {
  const values = updateEmployeeSchema.parse(input);

  const existing = await store.getEmployee(actor.organizationId, employeeId);
  if (!existing) throw new EmployeeNotFoundError();

  const updated = await store.updateEmployee(actor.organizationId, employeeId, {
    name: values.name,
    roleTitle: values.roleTitle,
    department: emptyToNull(values.department),
    description: emptyToNull(values.description),
    status: values.status as AiEmployee["status"],
    visibility: values.visibility as AiEmployee["visibility"],
  });
  if (!updated) throw new EmployeeNotFoundError();

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "employee.updated",
    targetType: "employee",
    targetId: employeeId,
    metadata: { name: updated.name },
  });

  // A status change made through the edit form still emits its lifecycle event.
  if (existing.status !== updated.status) {
    await recordStatusEvent(store, actor, updated);
  }

  return updated;
}

async function recordStatusEvent(
  store: DataStore,
  actor: EmployeeActor,
  employee: AiEmployee,
): Promise<void> {
  const action =
    employee.status === "paused"
      ? "employee.paused"
      : employee.status === "archived"
        ? "employee.archived"
        : null;
  if (!action) return;
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action,
    targetType: "employee",
    targetId: employee.id,
    metadata: { name: employee.name },
  });
}

async function setEmployeeStatus(
  store: DataStore,
  actor: EmployeeActor,
  employeeId: string,
  status: AiEmployee["status"],
  auditAction: string,
): Promise<AiEmployee> {
  const existing = await store.getEmployee(actor.organizationId, employeeId);
  if (!existing) throw new EmployeeNotFoundError();

  const updated = await store.updateEmployee(actor.organizationId, employeeId, { status });
  if (!updated) throw new EmployeeNotFoundError();

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: auditAction,
    targetType: "employee",
    targetId: employeeId,
    metadata: { name: updated.name },
  });

  return updated;
}

/** Pause an employee (records employee.paused). */
export function pauseEmployee(store: DataStore, actor: EmployeeActor, employeeId: string) {
  return setEmployeeStatus(store, actor, employeeId, "paused", "employee.paused");
}

/** Activate an employee (records employee.updated). */
export function activateEmployee(store: DataStore, actor: EmployeeActor, employeeId: string) {
  return setEmployeeStatus(store, actor, employeeId, "active", "employee.updated");
}

/**
 * Archive an employee (records employee.archived). Archiving is the soft-delete
 * for AI Employees — important business objects are archived, never hard-deleted.
 */
export function archiveEmployee(store: DataStore, actor: EmployeeActor, employeeId: string) {
  return setEmployeeStatus(store, actor, employeeId, "archived", "employee.archived");
}
