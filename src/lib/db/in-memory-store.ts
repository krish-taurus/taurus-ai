/**
 * In-memory DataStore (Prompt 002).
 *
 * Used when DATABASE_URL is unset (local dev without PostgreSQL) and in tests.
 * Data is process-local and non-durable. Not for production use.
 */

import type { DataStore } from "@/lib/db/store";
import type {
  AiEmployee,
  ArchiveDnaVersionInput,
  AssignKnowledgeInput,
  AuditEvent,
  AuditEventInput,
  CreateEmployeeInput,
  CreateKnowledgeDocumentInput,
  CreateKnowledgeSourceInput,
  CreateOrganizationInput,
  CreateUserInput,
  EmployeeDnaOverview,
  EmployeeDnaVersion,
  EmployeeKnowledgeAssignment,
  KnowledgeDocument,
  KnowledgeSource,
  KnowledgeVaultOverview,
  Organization,
  OrganizationMember,
  OrganizationMembershipView,
  PublishDnaInput,
  SaveDnaDraftInput,
  UpdateEmployeeInput,
  UpdateKnowledgeSourceInput,
  User,
} from "@/lib/db/types";
import { DEFAULT_MEMBER_ROLE, type Role } from "@/modules/organizations/roles";
import { DNA_SCHEMA_VERSION } from "@/modules/employee-dna/schema";

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
  private dnaVersions = new Map<string, EmployeeDnaVersion>();
  private knowledgeSources = new Map<string, KnowledgeSource>();
  private knowledgeDocuments = new Map<string, KnowledgeDocument>();
  private knowledgeAssignments = new Map<string, EmployeeKnowledgeAssignment>();
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
      responsibilities: input.responsibilities ?? [],
      workingStyle: input.workingStyle ?? null,
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

  // --- Employee DNA (Prompt 005) --------------------------------------------

  private dnaVersionsFor(organizationId: string, employeeId: string): EmployeeDnaVersion[] {
    return [...this.dnaVersions.values()].filter(
      (v) => v.organizationId === organizationId && v.employeeId === employeeId,
    );
  }

  async getDraftEmployeeDna(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDnaVersion | null> {
    return (
      this.dnaVersionsFor(organizationId, employeeId).find((v) => v.status === "draft") ?? null
    );
  }

  async getPublishedEmployeeDna(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDnaVersion | null> {
    return (
      this.dnaVersionsFor(organizationId, employeeId).find((v) => v.status === "published") ?? null
    );
  }

  async listEmployeeDnaVersions(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDnaVersion[]> {
    return this.dnaVersionsFor(organizationId, employeeId).sort(
      (a, b) => b.versionNumber - a.versionNumber,
    );
  }

  async getEmployeeDnaOverview(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDnaOverview> {
    const versions = await this.listEmployeeDnaVersions(organizationId, employeeId);
    return {
      draft: versions.find((v) => v.status === "draft") ?? null,
      published: versions.find((v) => v.status === "published") ?? null,
      versions,
    };
  }

  async saveEmployeeDnaDraft(input: SaveDnaDraftInput): Promise<EmployeeDnaVersion> {
    const dna = JSON.parse(JSON.stringify(input.dna)) as EmployeeDnaVersion["dna"];
    const existingDraft = await this.getDraftEmployeeDna(input.organizationId, input.employeeId);

    if (existingDraft) {
      const updated: EmployeeDnaVersion = { ...existingDraft, dna, updatedAt: now() };
      this.dnaVersions.set(updated.id, updated);
      return updated;
    }

    const versions = this.dnaVersionsFor(input.organizationId, input.employeeId);
    const nextVersion = versions.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1;
    const timestamp = now();
    const draft: EmployeeDnaVersion = {
      id: uuid(),
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      versionNumber: nextVersion,
      status: "draft",
      schemaVersion: DNA_SCHEMA_VERSION,
      dna,
      createdByUserId: input.userId,
      publishedByUserId: null,
      publishedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.dnaVersions.set(draft.id, draft);
    return draft;
  }

  async publishEmployeeDna(input: PublishDnaInput): Promise<EmployeeDnaVersion> {
    const draft = await this.getDraftEmployeeDna(input.organizationId, input.employeeId);
    if (!draft) {
      throw new Error("There is no draft Employee DNA to publish.");
    }

    // At most one published version: archive the previous one first.
    const published = await this.getPublishedEmployeeDna(input.organizationId, input.employeeId);
    if (published) {
      this.dnaVersions.set(published.id, {
        ...published,
        status: "archived",
        updatedAt: now(),
      });
    }

    const timestamp = now();
    const promoted: EmployeeDnaVersion = {
      ...draft,
      status: "published",
      publishedByUserId: input.userId,
      publishedAt: timestamp,
      updatedAt: timestamp,
    };
    this.dnaVersions.set(promoted.id, promoted);
    return promoted;
  }

  async archiveEmployeeDnaVersion(
    input: ArchiveDnaVersionInput,
  ): Promise<EmployeeDnaVersion | null> {
    const version = this.dnaVersions.get(input.versionId);
    if (
      !version ||
      version.organizationId !== input.organizationId ||
      version.employeeId !== input.employeeId
    ) {
      return null;
    }
    const archived: EmployeeDnaVersion = { ...version, status: "archived", updatedAt: now() };
    this.dnaVersions.set(archived.id, archived);
    return archived;
  }

  // --- Knowledge Vault (Prompt 006) -----------------------------------------

  async createKnowledgeSource(input: CreateKnowledgeSourceInput): Promise<KnowledgeSource> {
    const timestamp = now();
    const source: KnowledgeSource = {
      id: uuid(),
      organizationId: input.organizationId,
      name: input.name,
      description: input.description ?? null,
      sourceType: input.sourceType,
      status: input.status ?? "draft",
      visibility: input.visibility ?? "organization",
      createdByUserId: input.createdByUserId ?? null,
      archivedAt: null,
      metadata: input.metadata ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.knowledgeSources.set(source.id, source);
    return source;
  }

  async listKnowledgeSources(organizationId: string): Promise<KnowledgeSource[]> {
    return [...this.knowledgeSources.values()]
      .filter((s) => s.organizationId === organizationId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getKnowledgeSource(
    organizationId: string,
    sourceId: string,
  ): Promise<KnowledgeSource | null> {
    const source = this.knowledgeSources.get(sourceId);
    if (!source || source.organizationId !== organizationId) return null;
    return source;
  }

  async updateKnowledgeSource(
    organizationId: string,
    sourceId: string,
    patch: UpdateKnowledgeSourceInput,
  ): Promise<KnowledgeSource | null> {
    const existing = await this.getKnowledgeSource(organizationId, sourceId);
    if (!existing) return null;
    const updated: KnowledgeSource = {
      ...existing,
      ...("name" in patch && patch.name !== undefined ? { name: patch.name } : {}),
      ...("description" in patch ? { description: patch.description ?? null } : {}),
      ...("visibility" in patch && patch.visibility !== undefined
        ? { visibility: patch.visibility }
        : {}),
      ...("status" in patch && patch.status !== undefined ? { status: patch.status } : {}),
      updatedAt: now(),
    };
    this.knowledgeSources.set(updated.id, updated);
    return updated;
  }

  async archiveKnowledgeSource(
    organizationId: string,
    sourceId: string,
  ): Promise<KnowledgeSource | null> {
    const existing = await this.getKnowledgeSource(organizationId, sourceId);
    if (!existing) return null;
    const timestamp = now();
    const archived: KnowledgeSource = {
      ...existing,
      status: "archived",
      archivedAt: timestamp,
      updatedAt: timestamp,
    };
    this.knowledgeSources.set(archived.id, archived);
    return archived;
  }

  async createKnowledgeDocument(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocument> {
    const timestamp = now();
    const document: KnowledgeDocument = {
      id: uuid(),
      organizationId: input.organizationId,
      knowledgeSourceId: input.knowledgeSourceId,
      title: input.title,
      originalFilename: input.originalFilename ?? null,
      contentType: input.contentType ?? null,
      byteSize: input.byteSize ?? null,
      checksumSha256: input.checksumSha256 ?? null,
      storageKey: input.storageKey ?? null,
      textContent: input.textContent ?? null,
      textPreview: input.textPreview ?? null,
      extractionStatus: input.extractionStatus ?? "not_required",
      extractionError: input.extractionError ?? null,
      createdByUserId: input.createdByUserId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.knowledgeDocuments.set(document.id, document);
    return document;
  }

  async listKnowledgeDocumentsForSource(
    organizationId: string,
    sourceId: string,
  ): Promise<KnowledgeDocument[]> {
    return [...this.knowledgeDocuments.values()]
      .filter((d) => d.organizationId === organizationId && d.knowledgeSourceId === sourceId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getKnowledgeDocument(
    organizationId: string,
    documentId: string,
  ): Promise<KnowledgeDocument | null> {
    const doc = this.knowledgeDocuments.get(documentId);
    if (!doc || doc.organizationId !== organizationId) return null;
    return doc;
  }

  async assignKnowledgeSourceToEmployee(
    input: AssignKnowledgeInput,
  ): Promise<EmployeeKnowledgeAssignment> {
    const existing = [...this.knowledgeAssignments.values()].find(
      (a) =>
        a.organizationId === input.organizationId &&
        a.employeeId === input.employeeId &&
        a.knowledgeSourceId === input.knowledgeSourceId,
    );
    if (existing) return existing;
    const assignment: EmployeeKnowledgeAssignment = {
      id: uuid(),
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      knowledgeSourceId: input.knowledgeSourceId,
      assignedByUserId: input.assignedByUserId ?? null,
      createdAt: now(),
    };
    this.knowledgeAssignments.set(assignment.id, assignment);
    return assignment;
  }

  async unassignKnowledgeSourceFromEmployee(
    organizationId: string,
    employeeId: string,
    knowledgeSourceId: string,
  ): Promise<boolean> {
    const existing = [...this.knowledgeAssignments.values()].find(
      (a) =>
        a.organizationId === organizationId &&
        a.employeeId === employeeId &&
        a.knowledgeSourceId === knowledgeSourceId,
    );
    if (!existing) return false;
    this.knowledgeAssignments.delete(existing.id);
    return true;
  }

  async listKnowledgeSourcesForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<KnowledgeSource[]> {
    const sourceIds = [...this.knowledgeAssignments.values()]
      .filter((a) => a.organizationId === organizationId && a.employeeId === employeeId)
      .map((a) => a.knowledgeSourceId);
    return [...this.knowledgeSources.values()]
      .filter((s) => s.organizationId === organizationId && sourceIds.includes(s.id))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listEmployeesForKnowledgeSource(
    organizationId: string,
    knowledgeSourceId: string,
  ): Promise<AiEmployee[]> {
    const employeeIds = [...this.knowledgeAssignments.values()]
      .filter(
        (a) => a.organizationId === organizationId && a.knowledgeSourceId === knowledgeSourceId,
      )
      .map((a) => a.employeeId);
    return [...this.employees.values()]
      .filter((e) => e.organizationId === organizationId && employeeIds.includes(e.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async countAssignedKnowledgeForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<number> {
    return [...this.knowledgeAssignments.values()].filter(
      (a) => a.organizationId === organizationId && a.employeeId === employeeId,
    ).length;
  }

  async getKnowledgeVaultOverview(organizationId: string): Promise<KnowledgeVaultOverview> {
    const sources = (await this.listKnowledgeSources(organizationId)).filter(
      (s) => s.status !== "archived",
    );
    const assignedSourceIds = new Set(
      [...this.knowledgeAssignments.values()]
        .filter((a) => a.organizationId === organizationId)
        .map((a) => a.knowledgeSourceId),
    );
    return {
      total: sources.length,
      ready: sources.filter((s) => s.status === "ready").length,
      assigned: sources.filter((s) => assignedSourceIds.has(s.id)).length,
      recent: sources.slice(0, 5),
    };
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
      responsibilities: [],
      workingStyle: null,
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
