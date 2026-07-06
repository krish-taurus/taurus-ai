/**
 * Employee DNA service (Prompt 005).
 *
 * Pure domain logic over a DataStore — no Next.js — so it is unit-testable. It
 * validates DNA (Zod), delegates persistence + versioning to the store, and
 * writes audit events. Callers (server actions) resolve the organization + user
 * and enforce permissions before invoking these functions.
 *
 * Audit events: employee_dna.draft_saved, employee_dna.published,
 * employee_dna.archived. Audit metadata is minimal and never includes the full
 * DNA body.
 */

import type { DataStore } from "@/lib/db/store";
import type { EmployeeDnaOverview, EmployeeDnaVersion } from "@/lib/db/types";
import { dnaSchemaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";

export interface DnaActor {
  organizationId: string;
  userId: string;
}

/** The submitted DNA did not pass validation. */
export class DnaValidationError extends Error {
  constructor(message = "Please review the Employee DNA and try again.") {
    super(message);
    this.name = "DnaValidationError";
  }
}

/** The requested DNA version could not be found within the organization. */
export class DnaNotFoundError extends Error {
  constructor(message = "This Employee DNA version could not be found.") {
    super(message);
    this.name = "DnaNotFoundError";
  }
}

function validateDna(input: unknown): EmployeeDnaV1 {
  const parsed = dnaSchemaV1.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path?.length ? ` (${issue.path.join(".")})` : "";
    throw new DnaValidationError(
      `${issue?.message ?? "Some Employee DNA details are invalid."}${where}`,
    );
  }
  return parsed.data;
}

export function getDnaOverview(
  store: DataStore,
  organizationId: string,
  employeeId: string,
): Promise<EmployeeDnaOverview> {
  return store.getEmployeeDnaOverview(organizationId, employeeId);
}

/** Validate + save the draft; records employee_dna.draft_saved. */
export async function saveDnaDraft(
  store: DataStore,
  actor: DnaActor,
  employeeId: string,
  dnaInput: unknown,
): Promise<EmployeeDnaVersion> {
  const dna = validateDna(dnaInput);
  const version = await store.saveEmployeeDnaDraft({
    organizationId: actor.organizationId,
    employeeId,
    dna,
    userId: actor.userId,
  });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "employee_dna.draft_saved",
    targetType: "employee_dna",
    targetId: version.id,
    metadata: { employeeId, versionNumber: version.versionNumber },
  });

  return version;
}

/**
 * Validate + persist the latest draft, then publish it; records
 * employee_dna.published. Requires a valid draft (created here if needed).
 */
export async function publishDna(
  store: DataStore,
  actor: DnaActor,
  employeeId: string,
  dnaInput: unknown,
): Promise<EmployeeDnaVersion> {
  const dna = validateDna(dnaInput);
  // Persist the on-screen draft first (no separate draft_saved audit), then
  // promote it so "publish" always reflects what the user reviewed.
  await store.saveEmployeeDnaDraft({
    organizationId: actor.organizationId,
    employeeId,
    dna,
    userId: actor.userId,
  });

  const version = await store.publishEmployeeDna({
    organizationId: actor.organizationId,
    employeeId,
    userId: actor.userId,
  });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "employee_dna.published",
    targetType: "employee_dna",
    targetId: version.id,
    metadata: { employeeId, versionNumber: version.versionNumber },
  });

  return version;
}

/** Archive a DNA version; records employee_dna.archived. */
export async function archiveDnaVersion(
  store: DataStore,
  actor: DnaActor,
  employeeId: string,
  versionId: string,
): Promise<EmployeeDnaVersion> {
  const version = await store.archiveEmployeeDnaVersion({
    organizationId: actor.organizationId,
    employeeId,
    versionId,
    userId: actor.userId,
  });
  if (!version) throw new DnaNotFoundError();

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "employee_dna.archived",
    targetType: "employee_dna",
    targetId: version.id,
    metadata: { employeeId, versionNumber: version.versionNumber },
  });

  return version;
}
