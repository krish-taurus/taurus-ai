/**
 * Database entity types for Prompt 002 (Database, Auth, and Tenancy).
 *
 * Only the entities needed for authentication and organization tenancy are
 * modeled here. The remaining tables in db/migrations exist in the schema but
 * are not yet used by application logic (they belong to later prompts).
 */

import type { Role } from "@/modules/organizations/roles";

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  websiteUrl: string | null;
  sizeRange: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MembershipStatus = "active" | "invited" | "suspended";

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
}

/** An organization together with the current user's role/status in it. */
export interface OrganizationMembershipView {
  organization: Organization;
  membership: OrganizationMember;
}

export interface AuditEventInput {
  organizationId: string | null;
  actorType: "user" | "system" | "employee";
  actorId: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditEvent extends AuditEventInput {
  id: string;
  createdAt: string;
}

export interface CreateUserInput {
  email: string;
  fullName?: string | null;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  industry?: string | null;
  websiteUrl?: string | null;
  sizeRange?: string | null;
}
