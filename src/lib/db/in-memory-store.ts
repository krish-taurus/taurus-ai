/**
 * In-memory DataStore (Prompt 002).
 *
 * Used when DATABASE_URL is unset (local dev without PostgreSQL) and in tests.
 * Data is process-local and non-durable. Not for production use.
 */

import type { DataStore } from "@/lib/db/store";
import type {
  AiEmployee,
  AuditEvent,
  AuditEventInput,
  CreateEmployeeInput,
  CreateOrganizationInput,
  CreateUserInput,
  Organization,
  OrganizationMember,
  OrganizationMembershipView,
  UpdateEmployeeInput,
  User,
} from "@/lib/db/types";
import { DEFAULT_MEMBER_ROLE, type Role } from "@/modules/organizations/roles";

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

export class InMemoryStore implements DataStore {
  private users = new Map<string, User>();
  private organizations = new Map<string, Organization>();
  private members = new Map<string, OrganizationMember>();
  private employees = new Map<string, AiEmployee>();
  private auditEvents: AuditEvent[] = [];

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === normalized) return user;
    }
    return null;
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.getUserByEmail(email);
    if (existing) {
      throw new Error(`A user with email ${email} already exists.`);
    }
    const timestamp = now();
    const user: User = {
      id: uuid(),
      email,
      fullName: input.fullName?.trim() || null,
      avatarUrl: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.users.set(user.id, user);
    return user;
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    return this.organizations.get(id) ?? null;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    for (const org of this.organizations.values()) {
      if (org.slug === slug) return org;
    }
    return null;
  }

  async listOrganizationsForUser(userId: string): Promise<OrganizationMembershipView[]> {
    const views: OrganizationMembershipView[] = [];
    for (const membership of this.members.values()) {
      if (membership.userId !== userId) continue;
      const organization = this.organizations.get(membership.organizationId);
      if (organization) views.push({ organization, membership });
    }
    // Stable ordering by organization name for predictable UI.
    views.sort((a, b) => a.organization.name.localeCompare(b.organization.name));
    return views;
  }

  async getMembership(organizationId: string, userId: string): Promise<OrganizationMember | null> {
    for (const membership of this.members.values()) {
      if (membership.organizationId === organizationId && membership.userId === userId) {
        return membership;
      }
    }
    return null;
  }

  async createOrganizationWithOwner(input: {
    organization: CreateOrganizationInput;
    ownerUserId: string;
    ownerRole?: Role;
  }): Promise<OrganizationMembershipView> {
    const existingSlug = await this.getOrganizationBySlug(input.organization.slug);
    if (existingSlug) {
      throw new Error(`An organization with slug "${input.organization.slug}" already exists.`);
    }
    const timestamp = now();
    const organization: Organization = {
      id: uuid(),
      name: input.organization.name,
      slug: input.organization.slug,
      industry: input.organization.industry ?? null,
      websiteUrl: input.organization.websiteUrl ?? null,
      sizeRange: input.organization.sizeRange ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.organizations.set(organization.id, organization);

    const membership: OrganizationMember = {
      id: uuid(),
      organizationId: organization.id,
      userId: input.ownerUserId,
      role: input.ownerRole ?? "owner",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.members.set(membership.id, membership);

    return { organization, membership };
  }

  async createEmployee(input: CreateEmployeeInput): Promise<AiEmployee> {
    const timestamp = now();
    const employee: AiEmployee = {
      id: uuid(),
      organizationId: input.organizationId,
      name: input.name,
      roleTitle: input.roleTitle,
      department: input.department ?? null,
      description: input.description ?? null,
      status: input.status ?? "draft",
      visibility: input.visibility ?? "private",
      avatarUrl: null,
      createdBy: input.createdBy ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.employees.set(employee.id, employee);
    return employee;
  }

  async listEmployees(organizationId: string): Promise<AiEmployee[]> {
    const employees = [...this.employees.values()].filter(
      (employee) => employee.organizationId === organizationId,
    );
    // Most recently updated first.
    employees.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return employees;
  }

  async getEmployee(organizationId: string, employeeId: string): Promise<AiEmployee | null> {
    const employee = this.employees.get(employeeId);
    // Organization scoping: never return an employee from another organization.
    if (!employee || employee.organizationId !== organizationId) return null;
    return employee;
  }

  async updateEmployee(
    organizationId: string,
    employeeId: string,
    patch: UpdateEmployeeInput,
  ): Promise<AiEmployee | null> {
    const existing = await this.getEmployee(organizationId, employeeId);
    if (!existing) return null;
    const updated: AiEmployee = {
      ...existing,
      ...("name" in patch && patch.name !== undefined ? { name: patch.name } : {}),
      ...("roleTitle" in patch && patch.roleTitle !== undefined
        ? { roleTitle: patch.roleTitle }
        : {}),
      ...("department" in patch ? { department: patch.department ?? null } : {}),
      ...("description" in patch ? { description: patch.description ?? null } : {}),
      ...("status" in patch && patch.status !== undefined ? { status: patch.status } : {}),
      ...("visibility" in patch && patch.visibility !== undefined
        ? { visibility: patch.visibility }
        : {}),
      updatedAt: now(),
    };
    this.employees.set(updated.id, updated);
    return updated;
  }

  async getEmployeeOrganizationId(employeeId: string): Promise<string | null> {
    return this.employees.get(employeeId)?.organizationId ?? null;
  }

  async createAuditEvent(input: AuditEventInput): Promise<AuditEvent> {
    const event: AuditEvent = {
      ...input,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? {},
      id: uuid(),
      createdAt: now(),
    };
    this.auditEvents.push(event);
    return event;
  }

  // --- Test/dev helpers (not part of DataStore) -----------------------------

  /** Directly insert a user (test convenience). */
  async _seedUser(input: CreateUserInput): Promise<User> {
    return this.createUser(input);
  }

  /** Register an employee → organization mapping (used to test tenant checks). */
  _seedEmployee(employeeId: string, organizationId: string): void {
    const timestamp = now();
    this.employees.set(employeeId, {
      id: employeeId,
      organizationId,
      name: "Seed Employee",
      roleTitle: "Seed Role",
      department: null,
      description: null,
      status: "draft",
      visibility: "private",
      avatarUrl: null,
      createdBy: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  /** Default member role used when none is specified. */
  get defaultMemberRole(): Role {
    return DEFAULT_MEMBER_ROLE;
  }

  /** Read audit events (test convenience). */
  _auditEvents(): AuditEvent[] {
    return [...this.auditEvents];
  }
}
