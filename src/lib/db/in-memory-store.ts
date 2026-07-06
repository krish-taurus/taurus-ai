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
  ChannelOverview,
  CreateEmployeeChannelInput,
  CreateEmployeeChatMessageInput,
  CreateEmployeeChatRetrievalEventInput,
  CreateEmployeeChatThreadInput,
  CreatePublicChannelEventInput,
  CreatePublicChatSessionInput,
  EmployeeChannel,
  GetOrCreatePublicChatSessionInput,
  PublicChannelEvent,
  PublicChatSession,
  UpdateEmployeeChannelInput,
  CreateKnowledgeDocumentInput,
  CreateKnowledgeRetrievalSegmentInput,
  CreateKnowledgeSourceInput,
  CreateLlmUsageEventInput,
  CreateOrganizationInput,
  CreateUserInput,
  EmployeeChatMessage,
  EmployeeChatRetrievalEvent,
  EmployeeChatThread,
  EmployeeDnaOverview,
  EmployeeDnaVersion,
  EmployeeKnowledgeAssignment,
  EmployeeModelSettings,
  KnowledgeDocument,
  KnowledgeRetrievalSegment,
  KnowledgeSource,
  KnowledgeVaultOverview,
  LlmUsageEvent,
  ModelHubOverview,
  Organization,
  OrganizationMember,
  OrganizationMembershipView,
  OrganizationModelSettings,
  ProviderCredentialMetadata,
  ProviderSlug,
  PublishDnaInput,
  RankedRetrievalSegment,
  SaveDnaDraftInput,
  SaveProviderCredentialInput,
  UpdateEmployeeInput,
  UpdateEmployeeModelSettingsInput,
  UpdateKnowledgeSourceInput,
  UpdateOrganizationModelSettingsInput,
  User,
} from "@/lib/db/types";
import type { AiModel, ModelProvider } from "@/modules/model-gateway/types";
import { DEFAULT_MEMBER_ROLE, type Role } from "@/modules/organizations/roles";
import { DNA_SCHEMA_VERSION } from "@/modules/employee-dna/schema";
import {
  AI_MODELS,
  MODEL_PROVIDERS,
  getModel,
  modelsByProvider,
} from "@/modules/model-gateway/catalog";
import { rankSegments } from "@/modules/employee-chat/scoring";

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
  // Model Hub (Prompt 006B). Credentials keep the encrypted key internally; the
  // metadata getter strips it so it never leaves the store toward the client.
  private orgModelSettings = new Map<string, OrganizationModelSettings>();
  private employeeModelSettings = new Map<string, EmployeeModelSettings>();
  private providerCredentials = new Map<
    string,
    ProviderCredentialMetadata & { encryptedApiKey: string | null }
  >();
  private llmUsageEvents: LlmUsageEvent[] = [];
  // Employee Chat Runtime (Prompt 007).
  private chatThreads = new Map<string, EmployeeChatThread>();
  private chatMessages = new Map<string, EmployeeChatMessage>();
  private retrievalSegments = new Map<string, KnowledgeRetrievalSegment>();
  private chatRetrievalEvents: EmployeeChatRetrievalEvent[] = [];
  // Channels (Prompt 008).
  private channels = new Map<string, EmployeeChannel>();
  private publicSessions = new Map<string, PublicChatSession>();
  private publicChannelEvents: PublicChannelEvent[] = [];
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

  // --- Model Hub + LLM Gateway (Prompt 006B) --------------------------------

  async listModelProviders(): Promise<ModelProvider[]> {
    return [...MODEL_PROVIDERS];
  }

  async listAiModels(): Promise<AiModel[]> {
    return [...AI_MODELS];
  }

  async getAiModel(modelId: string): Promise<AiModel | null> {
    return getModel(modelId);
  }

  async getModelsByProvider(providerSlug: ProviderSlug): Promise<AiModel[]> {
    return modelsByProvider(providerSlug);
  }

  private defaultOrgModelSettings(organizationId: string): OrganizationModelSettings {
    const timestamp = now();
    return {
      id: uuid(),
      organizationId,
      defaultModelId: null,
      routingMode: "auto_balanced",
      allowedProviderSlugs: [],
      blockedProviderSlugs: [],
      monthlyBudgetUsd: null,
      budgetAlertThresholdPercent: null,
      fallbackModelId: null,
      updatedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  async getOrganizationModelSettings(organizationId: string): Promise<OrganizationModelSettings> {
    const existing = this.orgModelSettings.get(organizationId);
    if (existing) return existing;
    const created = this.defaultOrgModelSettings(organizationId);
    this.orgModelSettings.set(organizationId, created);
    return created;
  }

  async updateOrganizationModelSettings(
    organizationId: string,
    patch: UpdateOrganizationModelSettingsInput,
  ): Promise<OrganizationModelSettings> {
    const current = await this.getOrganizationModelSettings(organizationId);
    const updated: OrganizationModelSettings = {
      ...current,
      defaultModelId:
        patch.defaultModelId !== undefined ? patch.defaultModelId : current.defaultModelId,
      routingMode: patch.routingMode ?? current.routingMode,
      allowedProviderSlugs: patch.allowedProviderSlugs ?? current.allowedProviderSlugs,
      blockedProviderSlugs: patch.blockedProviderSlugs ?? current.blockedProviderSlugs,
      monthlyBudgetUsd:
        patch.monthlyBudgetUsd !== undefined ? patch.monthlyBudgetUsd : current.monthlyBudgetUsd,
      budgetAlertThresholdPercent:
        patch.budgetAlertThresholdPercent !== undefined
          ? patch.budgetAlertThresholdPercent
          : current.budgetAlertThresholdPercent,
      fallbackModelId:
        patch.fallbackModelId !== undefined ? patch.fallbackModelId : current.fallbackModelId,
      updatedByUserId: patch.updatedByUserId ?? current.updatedByUserId,
      updatedAt: now(),
    };
    this.orgModelSettings.set(organizationId, updated);
    return updated;
  }

  async getEmployeeModelSettings(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeModelSettings | null> {
    const found = this.employeeModelSettings.get(employeeId);
    if (!found || found.organizationId !== organizationId) return null;
    return found;
  }

  async updateEmployeeModelSettings(
    organizationId: string,
    employeeId: string,
    patch: UpdateEmployeeModelSettingsInput,
  ): Promise<EmployeeModelSettings> {
    const existing = await this.getEmployeeModelSettings(organizationId, employeeId);
    const timestamp = now();
    const base: EmployeeModelSettings = existing ?? {
      id: uuid(),
      organizationId,
      employeeId,
      modelId: null,
      routingMode: null,
      maxMonthlyBudgetUsd: null,
      fallbackModelId: null,
      updatedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const updated: EmployeeModelSettings = {
      ...base,
      modelId: patch.modelId !== undefined ? patch.modelId : base.modelId,
      routingMode: patch.routingMode !== undefined ? patch.routingMode : base.routingMode,
      maxMonthlyBudgetUsd:
        patch.maxMonthlyBudgetUsd !== undefined
          ? patch.maxMonthlyBudgetUsd
          : base.maxMonthlyBudgetUsd,
      fallbackModelId:
        patch.fallbackModelId !== undefined ? patch.fallbackModelId : base.fallbackModelId,
      updatedByUserId: patch.updatedByUserId ?? base.updatedByUserId,
      updatedAt: timestamp,
    };
    this.employeeModelSettings.set(employeeId, updated);
    return updated;
  }

  private credentialKey(organizationId: string, providerSlug: ProviderSlug): string {
    return `${organizationId}:${providerSlug}`;
  }

  private toCredentialMetadata(
    row: ProviderCredentialMetadata & { encryptedApiKey: string | null },
  ): ProviderCredentialMetadata {
    // Strip the encrypted key so it never leaves the store toward the UI.
    const { encryptedApiKey: _omit, ...metadata } = row;
    void _omit;
    return metadata;
  }

  async getProviderCredentialMetadata(
    organizationId: string,
    providerSlug: ProviderSlug,
  ): Promise<ProviderCredentialMetadata | null> {
    const row = this.providerCredentials.get(this.credentialKey(organizationId, providerSlug));
    return row ? this.toCredentialMetadata(row) : null;
  }

  async listProviderCredentialMetadata(
    organizationId: string,
  ): Promise<ProviderCredentialMetadata[]> {
    return [...this.providerCredentials.values()]
      .filter((row) => row.organizationId === organizationId)
      .map((row) => this.toCredentialMetadata(row));
  }

  async getProviderEncryptedKey(
    organizationId: string,
    providerSlug: ProviderSlug,
  ): Promise<string | null> {
    const row = this.providerCredentials.get(this.credentialKey(organizationId, providerSlug));
    return row?.encryptedApiKey ?? null;
  }

  async saveProviderCredential(
    input: SaveProviderCredentialInput,
  ): Promise<ProviderCredentialMetadata> {
    const key = this.credentialKey(input.organizationId, input.providerSlug);
    const existing = this.providerCredentials.get(key);
    const timestamp = now();
    const row: ProviderCredentialMetadata & { encryptedApiKey: string | null } = {
      id: existing?.id ?? uuid(),
      organizationId: input.organizationId,
      providerSlug: input.providerSlug,
      credentialMode: input.credentialMode,
      keyLastFour:
        input.keyLastFour !== undefined ? input.keyLastFour : (existing?.keyLastFour ?? null),
      status: input.status ?? "active",
      encryptedApiKey:
        input.encryptedApiKey !== undefined
          ? input.encryptedApiKey
          : (existing?.encryptedApiKey ?? null),
      createdByUserId: existing?.createdByUserId ?? input.userId ?? null,
      updatedByUserId: input.userId ?? null,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.providerCredentials.set(key, row);
    return this.toCredentialMetadata(row);
  }

  async disableProviderCredential(
    organizationId: string,
    providerSlug: ProviderSlug,
    userId?: string | null,
  ): Promise<ProviderCredentialMetadata | null> {
    const key = this.credentialKey(organizationId, providerSlug);
    const existing = this.providerCredentials.get(key);
    if (!existing) return null;
    const row = {
      ...existing,
      credentialMode: "disabled" as const,
      status: "disabled" as const,
      // Drop the stored key material entirely when disabling.
      encryptedApiKey: null,
      keyLastFour: null,
      updatedByUserId: userId ?? null,
      updatedAt: now(),
    };
    this.providerCredentials.set(key, row);
    return this.toCredentialMetadata(row);
  }

  async listLlmUsageEvents(organizationId: string, limit = 50): Promise<LlmUsageEvent[]> {
    return this.llmUsageEvents
      .filter((e) => e.organizationId === organizationId)
      .slice()
      .reverse()
      .slice(0, limit);
  }

  async createLlmUsageEvent(input: CreateLlmUsageEventInput): Promise<LlmUsageEvent> {
    const event: LlmUsageEvent = {
      id: uuid(),
      organizationId: input.organizationId,
      employeeId: input.employeeId ?? null,
      providerSlug: input.providerSlug,
      modelId: input.modelId,
      taskType: input.taskType,
      inputTokens: input.inputTokens,
      cachedInputTokens: input.cachedInputTokens ?? 0,
      outputTokens: input.outputTokens,
      estimatedCostUsd: input.estimatedCostUsd ?? null,
      latencyMs: input.latencyMs ?? null,
      status: input.status,
      errorCode: input.errorCode ?? null,
      requestIdHash: input.requestIdHash ?? null,
      createdByUserId: input.createdByUserId ?? null,
      createdAt: now(),
    };
    this.llmUsageEvents.push(event);
    return event;
  }

  async getModelHubOverview(organizationId: string): Promise<ModelHubOverview> {
    const settings = await this.getOrganizationModelSettings(organizationId);
    const usage = this.llmUsageEvents.filter((e) => e.organizationId === organizationId);
    const configured = [...this.providerCredentials.values()].filter(
      (row) => row.organizationId === organizationId && row.status === "active",
    ).length;
    const estimatedSpendUsd = usage.reduce((sum, e) => sum + (e.estimatedCostUsd ?? 0), 0);
    return {
      defaultModelId: settings.defaultModelId,
      routingMode: settings.routingMode,
      monthlyBudgetUsd: settings.monthlyBudgetUsd,
      allowedProviderCount:
        settings.allowedProviderSlugs.length > 0
          ? settings.allowedProviderSlugs.length
          : MODEL_PROVIDERS.length - settings.blockedProviderSlugs.length,
      totalProviders: MODEL_PROVIDERS.length,
      configuredProviderCount: configured,
      usageEventCount: usage.length,
      estimatedSpendUsd: Math.round(estimatedSpendUsd * 1e6) / 1e6,
      recentUsage: usage.slice().reverse().slice(0, 10),
    };
  }

  // --- Employee Chat Runtime (Prompt 007) -----------------------------------

  async createEmployeeChatThread(
    input: CreateEmployeeChatThreadInput,
  ): Promise<EmployeeChatThread> {
    const timestamp = now();
    const thread: EmployeeChatThread = {
      id: uuid(),
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      title: input.title ?? null,
      status: "active",
      createdByUserId: input.createdByUserId ?? null,
      archivedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.chatThreads.set(thread.id, thread);
    return thread;
  }

  async listEmployeeChatThreads(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeChatThread[]> {
    return [...this.chatThreads.values()]
      .filter((t) => t.organizationId === organizationId && t.employeeId === employeeId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getEmployeeChatThread(
    organizationId: string,
    threadId: string,
  ): Promise<EmployeeChatThread | null> {
    const thread = this.chatThreads.get(threadId);
    if (!thread || thread.organizationId !== organizationId) return null;
    return thread;
  }

  async getLatestEmployeeChatThreadForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeChatThread | null> {
    const active = (await this.listEmployeeChatThreads(organizationId, employeeId)).filter(
      (t) => t.status === "active",
    );
    return active[0] ?? null;
  }

  async archiveEmployeeChatThread(
    organizationId: string,
    threadId: string,
  ): Promise<EmployeeChatThread | null> {
    const thread = await this.getEmployeeChatThread(organizationId, threadId);
    if (!thread) return null;
    const updated: EmployeeChatThread = {
      ...thread,
      status: "archived",
      archivedAt: now(),
      updatedAt: now(),
    };
    this.chatThreads.set(updated.id, updated);
    return updated;
  }

  async createEmployeeChatMessage(
    input: CreateEmployeeChatMessageInput,
  ): Promise<EmployeeChatMessage> {
    const message: EmployeeChatMessage = {
      id: uuid(),
      organizationId: input.organizationId,
      threadId: input.threadId,
      employeeId: input.employeeId,
      role: input.role,
      content: input.content,
      status: input.status ?? "sent",
      sourceReferences: input.sourceReferences ?? null,
      modelProviderSlug: input.modelProviderSlug ?? null,
      modelId: input.modelId ?? null,
      modelTier: input.modelTier ?? null,
      routingMode: input.routingMode ?? null,
      inputTokens: input.inputTokens ?? null,
      outputTokens: input.outputTokens ?? null,
      estimatedCostUsd: input.estimatedCostUsd ?? null,
      latencyMs: input.latencyMs ?? null,
      errorCode: input.errorCode ?? null,
      brainMode: input.brainMode ?? null,
      createdByUserId: input.createdByUserId ?? null,
      createdAt: now(),
    };
    this.chatMessages.set(message.id, message);
    // Touch the thread's updatedAt so latest-thread ordering stays correct.
    const thread = this.chatThreads.get(input.threadId);
    if (thread) this.chatThreads.set(thread.id, { ...thread, updatedAt: message.createdAt });
    return message;
  }

  async listEmployeeChatMessages(
    organizationId: string,
    threadId: string,
  ): Promise<EmployeeChatMessage[]> {
    return [...this.chatMessages.values()]
      .filter((m) => m.organizationId === organizationId && m.threadId === threadId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async createKnowledgeRetrievalSegments(
    inputs: CreateKnowledgeRetrievalSegmentInput[],
  ): Promise<KnowledgeRetrievalSegment[]> {
    const created: KnowledgeRetrievalSegment[] = [];
    for (const input of inputs) {
      const timestamp = now();
      const segment: KnowledgeRetrievalSegment = {
        id: uuid(),
        organizationId: input.organizationId,
        knowledgeSourceId: input.knowledgeSourceId,
        knowledgeDocumentId: input.knowledgeDocumentId ?? null,
        title: input.title,
        content: input.content,
        contentPreview: input.contentPreview,
        segmentIndex: input.segmentIndex,
        status: "ready",
        metadata: input.metadata ?? {},
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.retrievalSegments.set(segment.id, segment);
      created.push(segment);
    }
    return created;
  }

  async listKnowledgeRetrievalSegmentsForSource(
    organizationId: string,
    knowledgeSourceId: string,
  ): Promise<KnowledgeRetrievalSegment[]> {
    return [...this.retrievalSegments.values()]
      .filter(
        (s) => s.organizationId === organizationId && s.knowledgeSourceId === knowledgeSourceId,
      )
      .sort((a, b) => a.segmentIndex - b.segmentIndex);
  }

  async listKnowledgeRetrievalSegmentsForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<KnowledgeRetrievalSegment[]> {
    // Only assigned, non-archived sources in this organization contribute.
    const assignedSourceIds = new Set(
      [...this.knowledgeAssignments.values()]
        .filter((a) => a.organizationId === organizationId && a.employeeId === employeeId)
        .map((a) => a.knowledgeSourceId),
    );
    const activeSourceIds = new Set(
      [...this.knowledgeSources.values()]
        .filter(
          (s) =>
            s.organizationId === organizationId &&
            assignedSourceIds.has(s.id) &&
            s.status !== "archived",
        )
        .map((s) => s.id),
    );
    return [...this.retrievalSegments.values()]
      .filter(
        (s) =>
          s.organizationId === organizationId &&
          activeSourceIds.has(s.knowledgeSourceId) &&
          s.status === "ready",
      )
      .sort((a, b) => a.segmentIndex - b.segmentIndex);
  }

  async searchKnowledgeRetrievalSegments(
    organizationId: string,
    employeeId: string,
    query: string,
    limit = 5,
  ): Promise<RankedRetrievalSegment[]> {
    const segments = await this.listKnowledgeRetrievalSegmentsForEmployee(
      organizationId,
      employeeId,
    );
    return rankSegments(query, segments, limit);
  }

  async deleteKnowledgeRetrievalSegmentsForSource(
    organizationId: string,
    knowledgeSourceId: string,
  ): Promise<number> {
    let removed = 0;
    for (const [id, segment] of this.retrievalSegments) {
      if (
        segment.organizationId === organizationId &&
        segment.knowledgeSourceId === knowledgeSourceId
      ) {
        this.retrievalSegments.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  async createEmployeeChatRetrievalEvent(
    input: CreateEmployeeChatRetrievalEventInput,
  ): Promise<EmployeeChatRetrievalEvent> {
    const event: EmployeeChatRetrievalEvent = {
      id: uuid(),
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      threadId: input.threadId ?? null,
      messageId: input.messageId ?? null,
      queryTextHash: input.queryTextHash ?? null,
      retrievedSourceCount: input.retrievedSourceCount,
      topSourceIds: input.topSourceIds,
      createdAt: now(),
    };
    this.chatRetrievalEvents.push(event);
    return event;
  }

  // --- Channels (Prompt 008) ------------------------------------------------

  async createEmployeeChannel(input: CreateEmployeeChannelInput): Promise<EmployeeChannel> {
    for (const existing of this.channels.values()) {
      if (existing.publicKey === input.publicKey) {
        throw new Error("A channel with this public key already exists.");
      }
    }
    const timestamp = now();
    const channel: EmployeeChannel = {
      id: uuid(),
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      channelType: input.channelType,
      channelProvider: input.channelProvider ?? "taurus_web",
      publicKey: input.publicKey,
      hasSecret: !!input.secretHash,
      name: input.name,
      status: input.status ?? "draft",
      allowedDomains: input.allowedDomains ?? [],
      appearance: input.appearance,
      providerConfig: input.providerConfig ?? {},
      welcomeMessage: input.welcomeMessage ?? null,
      rateLimitPerMinute: input.rateLimitPerMinute ?? 20,
      rateLimitPerDay: input.rateLimitPerDay ?? 500,
      createdByUserId: input.createdByUserId ?? null,
      archivedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.channels.set(channel.id, channel);
    return channel;
  }

  async listEmployeeChannelsForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeChannel[]> {
    return [...this.channels.values()]
      .filter((c) => c.organizationId === organizationId && c.employeeId === employeeId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getEmployeeChannel(
    organizationId: string,
    channelId: string,
  ): Promise<EmployeeChannel | null> {
    const channel = this.channels.get(channelId);
    if (!channel || channel.organizationId !== organizationId) return null;
    return channel;
  }

  async getEmployeeChannelByPublicKey(publicKey: string): Promise<EmployeeChannel | null> {
    for (const channel of this.channels.values()) {
      if (channel.publicKey === publicKey) return channel;
    }
    return null;
  }

  async updateEmployeeChannel(
    organizationId: string,
    channelId: string,
    patch: UpdateEmployeeChannelInput,
  ): Promise<EmployeeChannel | null> {
    const channel = await this.getEmployeeChannel(organizationId, channelId);
    if (!channel) return null;
    const updated: EmployeeChannel = {
      ...channel,
      name: patch.name ?? channel.name,
      allowedDomains: patch.allowedDomains ?? channel.allowedDomains,
      appearance: patch.appearance ?? channel.appearance,
      providerConfig: patch.providerConfig ?? channel.providerConfig,
      welcomeMessage:
        patch.welcomeMessage !== undefined ? patch.welcomeMessage : channel.welcomeMessage,
      rateLimitPerMinute: patch.rateLimitPerMinute ?? channel.rateLimitPerMinute,
      rateLimitPerDay: patch.rateLimitPerDay ?? channel.rateLimitPerDay,
      updatedAt: now(),
    };
    this.channels.set(updated.id, updated);
    return updated;
  }

  private async setChannelStatus(
    organizationId: string,
    channelId: string,
    status: EmployeeChannel["status"],
  ): Promise<EmployeeChannel | null> {
    const channel = await this.getEmployeeChannel(organizationId, channelId);
    if (!channel) return null;
    const updated: EmployeeChannel = {
      ...channel,
      status,
      archivedAt: status === "archived" ? now() : channel.archivedAt,
      updatedAt: now(),
    };
    this.channels.set(updated.id, updated);
    return updated;
  }

  async activateEmployeeChannel(
    organizationId: string,
    channelId: string,
  ): Promise<EmployeeChannel | null> {
    return this.setChannelStatus(organizationId, channelId, "active");
  }

  async pauseEmployeeChannel(
    organizationId: string,
    channelId: string,
  ): Promise<EmployeeChannel | null> {
    return this.setChannelStatus(organizationId, channelId, "paused");
  }

  async archiveEmployeeChannel(
    organizationId: string,
    channelId: string,
  ): Promise<EmployeeChannel | null> {
    return this.setChannelStatus(organizationId, channelId, "archived");
  }

  async createPublicChatSession(input: CreatePublicChatSessionInput): Promise<PublicChatSession> {
    const timestamp = now();
    const session: PublicChatSession = {
      id: uuid(),
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      channelId: input.channelId,
      threadId: input.threadId ?? null,
      visitorId: input.visitorId,
      visitorLabel: input.visitorLabel ?? null,
      originDomain: input.originDomain ?? null,
      userAgentHash: input.userAgentHash ?? null,
      ipHash: input.ipHash ?? null,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    };
    this.publicSessions.set(session.id, session);
    return session;
  }

  async getPublicChatSession(
    channelId: string,
    sessionId: string,
  ): Promise<PublicChatSession | null> {
    const session = this.publicSessions.get(sessionId);
    if (!session || session.channelId !== channelId) return null;
    return session;
  }

  async getOrCreatePublicChatSession(
    input: GetOrCreatePublicChatSessionInput,
  ): Promise<PublicChatSession> {
    const existing = [...this.publicSessions.values()].find(
      (s) =>
        s.channelId === input.channelId && s.visitorId === input.visitorId && s.status === "active",
    );
    if (existing) return existing;

    // Each visitor gets an isolated conversation thread.
    const thread = await this.createEmployeeChatThread({
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      title: "Website visitor",
      createdByUserId: null,
    });
    return this.createPublicChatSession({ ...input, threadId: thread.id });
  }

  async createPublicChannelEvent(
    input: CreatePublicChannelEventInput,
  ): Promise<PublicChannelEvent> {
    const event: PublicChannelEvent = {
      id: uuid(),
      organizationId: input.organizationId,
      employeeId: input.employeeId ?? null,
      channelId: input.channelId ?? null,
      eventType: input.eventType,
      metadata: input.metadata ?? {},
      createdAt: now(),
    };
    this.publicChannelEvents.push(event);
    return event;
  }

  async listPublicChannelEventsForEmployee(
    organizationId: string,
    employeeId: string,
    limit = 50,
  ): Promise<PublicChannelEvent[]> {
    return this.publicChannelEvents
      .filter((e) => e.organizationId === organizationId && e.employeeId === employeeId)
      .slice()
      .reverse()
      .slice(0, limit);
  }

  async getChannelOverview(organizationId: string, employeeId: string): Promise<ChannelOverview> {
    const channels = await this.listEmployeeChannelsForEmployee(organizationId, employeeId);
    const nonArchived = channels.filter((c) => c.status !== "archived");
    const webChannel = nonArchived.find((c) => c.channelProvider === "taurus_web") ?? null;
    const sessionCount = [...this.publicSessions.values()].filter(
      (s) => s.organizationId === organizationId && s.employeeId === employeeId,
    ).length;
    const recentEvents = await this.listPublicChannelEventsForEmployee(
      organizationId,
      employeeId,
      10,
    );
    return {
      totalChannels: nonArchived.length,
      activeChannels: nonArchived.filter((c) => c.status === "active").length,
      webChannel,
      sessionCount,
      recentEvents,
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
