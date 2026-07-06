/**
 * Database entity types for Prompt 002 (Database, Auth, and Tenancy).
 *
 * Only the entities needed for authentication and organization tenancy are
 * modeled here. The remaining tables in db/migrations exist in the schema but
 * are not yet used by application logic (they belong to later prompts).
 */

import type { Role } from "@/modules/organizations/roles";
import type { EmployeeDnaV1 } from "@/modules/employee-dna/schema";

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

// --- AI Employees (Prompt 003) ---------------------------------------------

export type EmployeeStatus = "draft" | "training" | "active" | "paused" | "archived";

export type EmployeeVisibility = "private" | "organization" | "network_ready";

// Working style (Prompt 004: Hiring Studio). Plain, non-technical dimensions a
// business user chooses when hiring — never model or prompt settings.
export type EmployeeTone = "friendly" | "professional" | "warm" | "direct" | "luxury" | "playful";

export type EmployeeFormality = "casual" | "balanced" | "formal";

export type EmployeeRiskLevel = "conservative" | "balanced" | "proactive";

export type EmployeeEscalation = "ask_when_unsure" | "ask_before_important" | "only_critical";

export interface WorkingStyle {
  tone: EmployeeTone;
  formality: EmployeeFormality;
  riskLevel: EmployeeRiskLevel;
  escalation: EmployeeEscalation;
}

/**
 * An AI Employee: a persistent AI worker owned by an organization. Every
 * employee is tenant-scoped via `organizationId`; there is no way to read an
 * employee without an organization context (see DataStore.getEmployee).
 */
export interface AiEmployee {
  id: string;
  organizationId: string;
  name: string;
  roleTitle: string;
  department: string | null;
  description: string | null;
  status: EmployeeStatus;
  visibility: EmployeeVisibility;
  /** Main responsibilities chosen during hiring (plain-language bullet points). */
  responsibilities: string[];
  /** Working style chosen during hiring; null for employees created before it existed. */
  workingStyle: WorkingStyle | null;
  avatarUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeInput {
  organizationId: string;
  name: string;
  roleTitle: string;
  department?: string | null;
  description?: string | null;
  status?: EmployeeStatus;
  visibility?: EmployeeVisibility;
  responsibilities?: string[];
  workingStyle?: WorkingStyle | null;
  createdBy?: string | null;
}

/** Fields that may be patched on an existing employee. */
export interface UpdateEmployeeInput {
  name?: string;
  roleTitle?: string;
  department?: string | null;
  description?: string | null;
  status?: EmployeeStatus;
  visibility?: EmployeeVisibility;
}

// --- Employee DNA versions (Prompt 005) ------------------------------------

export type DnaStatus = "draft" | "published" | "archived";

/**
 * A versioned Employee DNA record. Organization-scoped and tied to one employee.
 * The `dna` payload conforms to EmployeeDnaV1 (schemaVersion "1.0").
 */
export interface EmployeeDnaVersion {
  id: string;
  organizationId: string;
  employeeId: string;
  versionNumber: number;
  status: DnaStatus;
  schemaVersion: string;
  dna: EmployeeDnaV1;
  createdByUserId: string | null;
  publishedByUserId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Snapshot of an employee's DNA state used to render the DNA + detail pages. */
export interface EmployeeDnaOverview {
  draft: EmployeeDnaVersion | null;
  published: EmployeeDnaVersion | null;
  /** All versions, newest first. */
  versions: EmployeeDnaVersion[];
}

export interface SaveDnaDraftInput {
  organizationId: string;
  employeeId: string;
  dna: EmployeeDnaV1;
  userId: string;
}

export interface PublishDnaInput {
  organizationId: string;
  employeeId: string;
  userId: string;
}

export interface ArchiveDnaVersionInput {
  organizationId: string;
  employeeId: string;
  versionId: string;
  userId: string;
}
