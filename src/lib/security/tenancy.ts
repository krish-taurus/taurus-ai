/**
 * Tenant-isolation logic (Prompt 002).
 *
 * These are pure functions over a DataStore so they can be unit-tested without
 * Next.js. The request-facing guards in guards.ts wrap them with session +
 * redirect handling. Centralizing tenant checks here means there is exactly one
 * place that decides "can this user act inside this organization".
 *
 * Rule: a user may only access an organization where they have an ACTIVE
 * membership. Access is denied by default.
 */

import type { DataStore } from "@/lib/db/store";
import type { OrganizationMember } from "@/lib/db/types";
import type { Role } from "@/modules/organizations/roles";

/** The current user is not an active member of the requested organization. */
export class TenantAccessError extends Error {
  constructor(message = "You do not have access to this organization.") {
    super(message);
    this.name = "TenantAccessError";
  }
}

/** The user is a member but lacks the required role/permission. */
export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Resolve and validate the user's membership in an organization.
 * Throws TenantAccessError if there is no active membership.
 */
export async function resolveMembership(
  store: DataStore,
  userId: string,
  organizationId: string,
): Promise<OrganizationMember> {
  const membership = await store.getMembership(organizationId, userId);
  if (!membership || membership.status !== "active") {
    throw new TenantAccessError();
  }
  return membership;
}

/** Assert a membership's role is within the allowed set. */
export function assertRole(membership: OrganizationMember, allowedRoles: readonly Role[]): void {
  if (!allowedRoles.includes(membership.role)) {
    throw new ForbiddenError();
  }
}

/**
 * Assert an employee belongs to the given organization. Prevents acting on an
 * employee across organization boundaries. No employees exist until Prompt 003,
 * so this currently rejects any employee id; the check is the durable seam.
 */
export async function assertEmployeeInOrganization(
  store: DataStore,
  employeeId: string,
  organizationId: string,
): Promise<void> {
  const employeeOrgId = await store.getEmployeeOrganizationId(employeeId);
  if (employeeOrgId === null || employeeOrgId !== organizationId) {
    throw new TenantAccessError("This employee does not belong to your organization.");
  }
}
