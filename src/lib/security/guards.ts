/**
 * Request-facing security guards (Prompt 002) — server only.
 *
 * These are the centralized entry points every protected server component and
 * server action must use. They combine session resolution with the pure tenant
 * logic in tenancy.ts and redirect on failure.
 *
 * Exposed helpers (as required by Prompt 002):
 *   - requireUser()
 *   - requireOrganizationMember(organizationId)
 *   - requireRole(organizationId, allowedRoles)
 *   - assertEmployeeInOrganization(employeeId, organizationId)
 *
 * Plus requireCurrentOrganization() which resolves the user's selected org for
 * the dashboard.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import type {
  Organization,
  OrganizationMember,
  OrganizationMembershipView,
  User,
} from "@/lib/db/types";
import { getCurrentUser } from "@/modules/auth/current-user";
import type { Role } from "@/modules/organizations/roles";
import {
  assertEmployeeInOrganization as assertEmployeeInOrganizationPure,
  assertRole,
  resolveMembership,
  TenantAccessError,
} from "@/lib/security/tenancy";

/** Cookie holding the user's currently selected organization id. */
export const ORG_COOKIE = "taurus_org";

/** Require an authenticated user, or redirect to /login. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export interface OrganizationContext {
  user: User;
  organization: Organization;
  membership: OrganizationMember;
}

/**
 * Require the user to be an active member of the given organization.
 * Redirects to /dashboard (their own scope) if they are not.
 */
export async function requireOrganizationMember(
  organizationId: string,
): Promise<OrganizationContext> {
  const user = await requireUser();
  const store = getStore();
  try {
    const membership = await resolveMembership(store, user.id, organizationId);
    const organization = await store.getOrganizationById(organizationId);
    if (!organization) throw new TenantAccessError();
    return { user, organization, membership };
  } catch {
    redirect("/dashboard");
  }
}

/**
 * Require the user to hold one of the allowed roles in the organization.
 * Redirects to the organization dashboard if the role is insufficient.
 */
export async function requireRole(
  organizationId: string,
  allowedRoles: readonly Role[],
): Promise<OrganizationContext> {
  const context = await requireOrganizationMember(organizationId);
  try {
    assertRole(context.membership, allowedRoles);
  } catch {
    redirect("/dashboard");
  }
  return context;
}

/** Assert an employee belongs to the organization (throws on mismatch). */
export async function assertEmployeeInOrganization(
  employeeId: string,
  organizationId: string,
): Promise<void> {
  await assertEmployeeInOrganizationPure(getStore(), employeeId, organizationId);
}

export interface CurrentOrganizationContext extends OrganizationContext {
  /** All organizations the user belongs to (for the org switcher). */
  organizations: OrganizationMembershipView[];
}

/**
 * Resolve the user's active organization for the dashboard:
 *   - requires an authenticated user,
 *   - redirects to /onboarding if they belong to no organization,
 *   - honors the selected-organization cookie when valid, else the first org.
 */
export async function requireCurrentOrganization(): Promise<CurrentOrganizationContext> {
  const user = await requireUser();
  const store = getStore();
  const organizations = await store.listOrganizationsForUser(user.id);

  if (organizations.length === 0) {
    redirect("/onboarding");
  }

  const selectedId = cookies().get(ORG_COOKIE)?.value;
  const selected =
    organizations.find((view) => view.organization.id === selectedId) ?? organizations[0];

  return {
    user,
    organization: selected.organization,
    membership: selected.membership,
    organizations,
  };
}
