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
  BillingSubscription,
  BillingCustomer,
  BillingEvent,
  CreateBillingSubscriptionInput,
  UpdateBillingSubscriptionInput,
  UpsertBillingCustomerInput,
  CreateBillingEventInput,
  CreateEmployeeInput,
  ChannelOverview,
  ChannelProviderCredentialMetadata,
  ChannelProviderType,
  ChannelWebhookEvent,
  CreateChannelProviderCredentialInput,
  CreateChannelWebhookEventInput,
  CreateMessagingTemplateInput,
  MessagingChannelOverview,
  MessagingChannelSummary,
  MessagingContactPreference,
  MessagingTemplate,
  MessagingTemplateStatus,
  UpdateChannelWebhookEventStatusInput,
  UpsertMessagingContactPreferenceInput,
  CreateVoicePhoneNumberInput,
  CreateVoiceCallSessionInput,
  CreateVoiceTranscriptMessageInput,
  CreateVoiceStreamEventInput,
  UpdateVoicePhoneNumberInput,
  UpdateVoiceCallSessionStatusInput,
  VoicePhoneNumber,
  VoiceCallSession,
  VoiceTranscriptMessage,
  VoiceStreamEvent,
  VoiceChannelOverview,
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
  ModelAccessMode,
  ModelHubOverview,
  Organization,
  UsageCostAggregateRow,
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
import { DEFAULT_PLAN_ID } from "@/modules/billing/plans";
import { addOneMonthIso, isBillableInteraction } from "@/modules/billing/metadata";

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
  // Messaging Channels (Prompt 009). Credentials keep the encrypted blob
  // internally; the metadata getter strips it so it never leaves the store.
  private providerCredentials2 = new Map<
    string,
    ChannelProviderCredentialMetadata & { encryptedCredentials: string | null }
  >();
  private webhookEvents = new Map<string, ChannelWebhookEvent>();
  private messagingTemplates = new Map<string, MessagingTemplate>();
  private contactPreferences = new Map<string, MessagingContactPreference>();
  // Voice Call Channel (Prompt 010).
  private voicePhoneNumbers = new Map<string, VoicePhoneNumber>();
  private voiceCallSessions = new Map<string, VoiceCallSession>();
  private voiceTranscriptMessages = new Map<string, VoiceTranscriptMessage>();
  private voiceStreamEvents = new Map<string, VoiceStreamEvent>();
  // Billing (Sprint 015). One subscription + one customer mapping per org.
  private billingSubscriptions = new Map<string, BillingSubscription>();
  private billingCustomers = new Map<string, BillingCustomer>();
  private billingEvents: BillingEvent[] = [];
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

  async getUserBySupabaseAuthId(supabaseAuthUserId: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.supabaseAuthUserId === supabaseAuthUserId) return user;
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
      avatarUrl: input.avatarUrl?.trim() || null,
      supabaseAuthUserId: input.supabaseAuthUserId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.users.set(user.id, user);
    return user;
  }

  async linkUserToSupabaseAuth(userId: string, supabaseAuthUserId: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error(`User ${userId} not found.`);
    const updated: User = { ...user, supabaseAuthUserId, updatedAt: now() };
    this.users.set(userId, updated);
    return updated;
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

  async updateOrganizationModelAccessMode(
    organizationId: string,
    mode: ModelAccessMode,
  ): Promise<Organization> {
    const org = this.organizations.get(organizationId);
    if (!org) throw new Error(`Organization ${organizationId} not found.`);
    const updated: Organization = { ...org, modelAccessMode: mode, updatedAt: now() };
    this.organizations.set(organizationId, updated);
    return updated;
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
      // Zero-setup default: managed access mode (Sprint 016).
      modelAccessMode: "managed",
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

    // Every organization starts on Starter (Free) implicitly so the product is
    // usable immediately — no card required (Sprint 015).
    await this.createBillingSubscription({
      organizationId: organization.id,
      planId: DEFAULT_PLAN_ID,
      status: "active",
      provider: "simulated",
    });

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
      baseUrl: input.baseUrl !== undefined ? input.baseUrl : (existing?.baseUrl ?? null),
      label: input.label !== undefined ? input.label : (existing?.label ?? null),
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

  async countInteractionsForEmployee(organizationId: string, employeeId: string): Promise<number> {
    return this.llmUsageEvents.filter(
      (e) =>
        e.organizationId === organizationId &&
        e.employeeId === employeeId &&
        e.status !== "blocked" &&
        isBillableInteraction(e.taskType),
    ).length;
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
      costUsd: input.costUsd ?? null,
      unitInputPrice: input.unitInputPrice ?? null,
      unitOutputPrice: input.unitOutputPrice ?? null,
      byok: input.byok ?? false,
      channelType: input.channelType ?? null,
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

  // --- Usage & cost aggregates (Sprint 016) ---------------------------------

  /** Billable usage events for an organization since a timestamp (tenant-scoped). */
  async listBillableUsageEventsSince(
    organizationId: string,
    sinceIso: string,
  ): Promise<LlmUsageEvent[]> {
    return this.llmUsageEvents.filter(
      (e) =>
        e.organizationId === organizationId &&
        e.status !== "blocked" &&
        isBillableInteraction(e.taskType) &&
        e.createdAt >= sinceIso,
    );
  }

  /**
   * Cross-tenant per-organization usage-cost aggregate since a timestamp.
   * OPERATOR-ONLY: never call from a tenant route (it is not org-scoped).
   */
  async aggregateUsageCostsSince(sinceIso: string): Promise<UsageCostAggregateRow[]> {
    const byOrg = new Map<string, UsageCostAggregateRow>();
    for (const e of this.llmUsageEvents) {
      if (e.status === "blocked" || !isBillableInteraction(e.taskType)) continue;
      if (e.createdAt < sinceIso) continue;
      const row =
        byOrg.get(e.organizationId) ??
        ({
          organizationId: e.organizationId,
          interactionCount: 0,
          managedInteractionCount: 0,
          byokInteractionCount: 0,
          totalCostUsd: 0,
        } satisfies UsageCostAggregateRow);
      row.interactionCount += 1;
      if (e.byok) row.byokInteractionCount += 1;
      else row.managedInteractionCount += 1;
      row.totalCostUsd += e.costUsd ?? 0;
      byOrg.set(e.organizationId, row);
    }
    return [...byOrg.values()];
  }

  /**
   * Every organization's current subscription. OPERATOR-ONLY (cross-tenant) —
   * used to compute per-org revenue for the margin view.
   */
  async listAllBillingSubscriptions(): Promise<BillingSubscription[]> {
    return [...this.billingSubscriptions.values()];
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

  async listEmployeeChannelsForOrganization(organizationId: string): Promise<EmployeeChannel[]> {
    return [...this.channels.values()]
      .filter((c) => c.organizationId === organizationId)
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

  // --- Messaging Channels (Prompt 009) --------------------------------------

  private credKey(organizationId: string, providerType: ChannelProviderType): string {
    return `${organizationId}:${providerType}`;
  }

  private toCredMetadata(
    row: ChannelProviderCredentialMetadata & { encryptedCredentials: string | null },
  ): ChannelProviderCredentialMetadata {
    const { encryptedCredentials: _omit, ...metadata } = row;
    void _omit;
    return metadata;
  }

  async createChannelProviderCredential(
    input: CreateChannelProviderCredentialInput,
  ): Promise<ChannelProviderCredentialMetadata> {
    const key = this.credKey(input.organizationId, input.providerType);
    const existing = this.providerCredentials2.get(key);
    const timestamp = now();
    const row: ChannelProviderCredentialMetadata & { encryptedCredentials: string | null } = {
      id: existing?.id ?? uuid(),
      organizationId: input.organizationId,
      providerType: input.providerType,
      credentialMode: input.credentialMode,
      credentialLabel:
        input.credentialLabel !== undefined
          ? input.credentialLabel
          : (existing?.credentialLabel ?? null),
      keyLastFour:
        input.keyLastFour !== undefined ? input.keyLastFour : (existing?.keyLastFour ?? null),
      hasSecret:
        input.encryptedCredentials !== undefined
          ? !!input.encryptedCredentials
          : (existing?.hasSecret ?? false),
      status: input.status ?? "active",
      encryptedCredentials:
        input.encryptedCredentials !== undefined
          ? input.encryptedCredentials
          : (existing?.encryptedCredentials ?? null),
      createdByUserId: existing?.createdByUserId ?? input.userId ?? null,
      updatedByUserId: input.userId ?? null,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.providerCredentials2.set(key, row);
    return this.toCredMetadata(row);
  }

  async getChannelProviderCredentialMetadata(
    organizationId: string,
    providerType: ChannelProviderType,
  ): Promise<ChannelProviderCredentialMetadata | null> {
    const row = this.providerCredentials2.get(this.credKey(organizationId, providerType));
    return row ? this.toCredMetadata(row) : null;
  }

  async listChannelProviderCredentials(
    organizationId: string,
  ): Promise<ChannelProviderCredentialMetadata[]> {
    return [...this.providerCredentials2.values()]
      .filter((r) => r.organizationId === organizationId)
      .map((r) => this.toCredMetadata(r));
  }

  async getChannelProviderEncryptedCredentials(
    organizationId: string,
    providerType: ChannelProviderType,
  ): Promise<string | null> {
    const row = this.providerCredentials2.get(this.credKey(organizationId, providerType));
    return row?.encryptedCredentials ?? null;
  }

  async disableChannelProviderCredential(
    organizationId: string,
    providerType: ChannelProviderType,
    userId?: string | null,
  ): Promise<ChannelProviderCredentialMetadata | null> {
    const key = this.credKey(organizationId, providerType);
    const existing = this.providerCredentials2.get(key);
    if (!existing) return null;
    const row = {
      ...existing,
      credentialMode: "disabled" as const,
      status: "disabled" as const,
      encryptedCredentials: null,
      keyLastFour: null,
      hasSecret: false,
      updatedByUserId: userId ?? null,
      updatedAt: now(),
    };
    this.providerCredentials2.set(key, row);
    return this.toCredMetadata(row);
  }

  async createChannelWebhookEvent(
    input: CreateChannelWebhookEventInput,
  ): Promise<ChannelWebhookEvent> {
    const timestamp = now();
    const event: ChannelWebhookEvent = {
      id: uuid(),
      organizationId: input.organizationId ?? null,
      channelId: input.channelId ?? null,
      providerType: input.providerType,
      eventType: input.eventType,
      externalEventId: input.externalEventId ?? null,
      status: input.status ?? "received",
      metadata: input.metadata ?? {},
      receivedAt: timestamp,
      processedAt: input.processedAt ?? null,
      errorCode: input.errorCode ?? null,
      createdAt: timestamp,
    };
    this.webhookEvents.set(event.id, event);
    return event;
  }

  async updateChannelWebhookEventStatus(
    id: string,
    input: UpdateChannelWebhookEventStatusInput,
  ): Promise<ChannelWebhookEvent | null> {
    const existing = this.webhookEvents.get(id);
    if (!existing) return null;
    const updated: ChannelWebhookEvent = {
      ...existing,
      status: input.status,
      processedAt: input.processedAt !== undefined ? input.processedAt : existing.processedAt,
      errorCode: input.errorCode !== undefined ? input.errorCode : existing.errorCode,
      metadata: input.metadata ? { ...existing.metadata, ...input.metadata } : existing.metadata,
    };
    this.webhookEvents.set(id, updated);
    return updated;
  }

  async listChannelWebhookEventsForChannel(
    organizationId: string,
    channelId: string,
    limit = 50,
  ): Promise<ChannelWebhookEvent[]> {
    return [...this.webhookEvents.values()]
      .filter((e) => e.organizationId === organizationId && e.channelId === channelId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .slice(0, limit);
  }

  async createMessagingTemplate(input: CreateMessagingTemplateInput): Promise<MessagingTemplate> {
    const timestamp = now();
    const template: MessagingTemplate = {
      id: uuid(),
      organizationId: input.organizationId,
      channelId: input.channelId ?? null,
      providerType: input.providerType,
      templateName: input.templateName,
      templateCategory: input.templateCategory ?? "utility",
      language: input.language ?? "en",
      status: input.status ?? "draft",
      externalTemplateId: input.externalTemplateId ?? null,
      bodyPreview: input.bodyPreview ?? null,
      metadata: input.metadata ?? {},
      createdByUserId: input.createdByUserId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.messagingTemplates.set(template.id, template);
    return template;
  }

  async listMessagingTemplates(
    organizationId: string,
    channelId?: string | null,
  ): Promise<MessagingTemplate[]> {
    return [...this.messagingTemplates.values()]
      .filter(
        (t) =>
          t.organizationId === organizationId &&
          (channelId === undefined || channelId === null || t.channelId === channelId),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async updateMessagingTemplateStatus(
    organizationId: string,
    templateId: string,
    status: MessagingTemplateStatus,
  ): Promise<MessagingTemplate | null> {
    const t = this.messagingTemplates.get(templateId);
    if (!t || t.organizationId !== organizationId) return null;
    const updated = { ...t, status, updatedAt: now() };
    this.messagingTemplates.set(templateId, updated);
    return updated;
  }

  private contactKey(channelId: string, hash: string): string {
    return `${channelId}:${hash}`;
  }

  async getMessagingContactPreference(
    organizationId: string,
    channelId: string,
    normalizedContactHash: string,
  ): Promise<MessagingContactPreference | null> {
    const pref = this.contactPreferences.get(this.contactKey(channelId, normalizedContactHash));
    if (!pref || pref.organizationId !== organizationId) return null;
    return pref;
  }

  async upsertMessagingContactPreference(
    input: UpsertMessagingContactPreferenceInput,
  ): Promise<MessagingContactPreference> {
    const key = this.contactKey(input.channelId, input.normalizedContactHash);
    const existing = this.contactPreferences.get(key);
    const timestamp = now();
    const pref: MessagingContactPreference = {
      id: existing?.id ?? uuid(),
      organizationId: input.organizationId,
      channelId: input.channelId,
      externalContactId:
        input.externalContactId !== undefined
          ? input.externalContactId
          : (existing?.externalContactId ?? null),
      normalizedContactHash: input.normalizedContactHash,
      channelType: input.channelType,
      optInStatus: input.optInStatus ?? existing?.optInStatus ?? "unknown",
      blockedAt: existing?.blockedAt ?? null,
      metadata: input.metadata ?? existing?.metadata ?? {},
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.contactPreferences.set(key, pref);
    return pref;
  }

  async blockMessagingContact(
    organizationId: string,
    channelId: string,
    normalizedContactHash: string,
    _userId?: string | null,
  ): Promise<MessagingContactPreference | null> {
    void _userId;
    const key = this.contactKey(channelId, normalizedContactHash);
    const existing = this.contactPreferences.get(key);
    const timestamp = now();
    const pref: MessagingContactPreference = existing
      ? { ...existing, optInStatus: "blocked", blockedAt: timestamp, updatedAt: timestamp }
      : {
          id: uuid(),
          organizationId,
          channelId,
          externalContactId: null,
          normalizedContactHash,
          channelType: "sms",
          optInStatus: "blocked",
          blockedAt: timestamp,
          metadata: {},
          createdAt: timestamp,
          updatedAt: timestamp,
        };
    if (pref.organizationId !== organizationId) return null;
    this.contactPreferences.set(key, pref);
    return pref;
  }

  async getMessagingChannelOverview(
    organizationId: string,
    employeeId: string,
  ): Promise<MessagingChannelOverview> {
    const channels = (
      await this.listEmployeeChannelsForEmployee(organizationId, employeeId)
    ).filter((c) => c.status !== "archived");
    const messagingTypes: MessagingChannelSummary["channelType"][] = ["whatsapp", "sms", "email"];
    const summaries: MessagingChannelSummary[] = [];
    for (const channelType of messagingTypes) {
      const channel = channels.find((c) => c.channelType === channelType) ?? null;
      let lastMessageAt: string | null = null;
      let credentialStatus: MessagingChannelSummary["credentialStatus"] = "not_configured";
      if (channel) {
        const events = await this.listChannelWebhookEventsForChannel(organizationId, channel.id, 1);
        lastMessageAt = events[0]?.receivedAt ?? null;
        const cred = await this.getChannelProviderCredentialMetadata(
          organizationId,
          channel.channelProvider,
        );
        credentialStatus = cred ? cred.status : "not_configured";
      }
      summaries.push({
        channelType,
        channel,
        providerType: channel?.channelProvider ?? null,
        credentialStatus,
        lastMessageAt,
      });
    }
    const recentWebhookEvents = [...this.webhookEvents.values()]
      .filter((e) => e.organizationId === organizationId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .slice(0, 10);
    return { summaries, recentWebhookEvents };
  }

  // --- Voice Call Channel (Prompt 010) --------------------------------------

  async createVoicePhoneNumber(input: CreateVoicePhoneNumberInput): Promise<VoicePhoneNumber> {
    const timestamp = now();
    const number: VoicePhoneNumber = {
      id: uuid(),
      organizationId: input.organizationId,
      channelId: input.channelId,
      providerType: input.providerType,
      phoneNumber: input.phoneNumber,
      displayLabel: input.displayLabel ?? null,
      externalPhoneNumberId: input.externalPhoneNumberId ?? null,
      countryCode: input.countryCode ?? null,
      capabilities: input.capabilities ?? {},
      status: input.status ?? "draft",
      createdByUserId: input.createdByUserId ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
    };
    this.voicePhoneNumbers.set(number.id, number);
    return number;
  }

  async listVoicePhoneNumbersForChannel(
    organizationId: string,
    channelId: string,
  ): Promise<VoicePhoneNumber[]> {
    return [...this.voicePhoneNumbers.values()]
      .filter(
        (n) =>
          n.organizationId === organizationId &&
          n.channelId === channelId &&
          n.status !== "archived",
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getVoicePhoneNumber(
    organizationId: string,
    phoneNumberId: string,
  ): Promise<VoicePhoneNumber | null> {
    const n = this.voicePhoneNumbers.get(phoneNumberId);
    if (!n || n.organizationId !== organizationId) return null;
    return n;
  }

  async updateVoicePhoneNumber(
    organizationId: string,
    phoneNumberId: string,
    patch: UpdateVoicePhoneNumberInput,
  ): Promise<VoicePhoneNumber | null> {
    const n = await this.getVoicePhoneNumber(organizationId, phoneNumberId);
    if (!n) return null;
    const updated: VoicePhoneNumber = {
      ...n,
      phoneNumber: patch.phoneNumber ?? n.phoneNumber,
      displayLabel: patch.displayLabel !== undefined ? patch.displayLabel : n.displayLabel,
      countryCode: patch.countryCode !== undefined ? patch.countryCode : n.countryCode,
      capabilities: patch.capabilities ?? n.capabilities,
      status: patch.status ?? n.status,
      updatedAt: now(),
    };
    this.voicePhoneNumbers.set(updated.id, updated);
    return updated;
  }

  async archiveVoicePhoneNumber(
    organizationId: string,
    phoneNumberId: string,
  ): Promise<VoicePhoneNumber | null> {
    const n = await this.getVoicePhoneNumber(organizationId, phoneNumberId);
    if (!n) return null;
    const updated: VoicePhoneNumber = {
      ...n,
      status: "archived",
      archivedAt: now(),
      updatedAt: now(),
    };
    this.voicePhoneNumbers.set(updated.id, updated);
    return updated;
  }

  async createVoiceCallSession(input: CreateVoiceCallSessionInput): Promise<VoiceCallSession> {
    const timestamp = now();
    const session: VoiceCallSession = {
      id: uuid(),
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      channelId: input.channelId,
      phoneNumberId: input.phoneNumberId ?? null,
      providerType: input.providerType,
      externalCallId: input.externalCallId ?? null,
      direction: input.direction ?? "inbound",
      callerHash: input.callerHash ?? null,
      callerLabel: input.callerLabel ?? null,
      status: input.status ?? "ringing",
      startedAt: timestamp,
      answeredAt: null,
      endedAt: null,
      durationSeconds: null,
      endReason: null,
      recordingStatus: input.recordingStatus ?? "disabled",
      transcriptStatus: input.transcriptStatus ?? "pending",
      metadata: input.metadata ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.voiceCallSessions.set(session.id, session);
    return session;
  }

  async getVoiceCallSession(
    organizationId: string,
    callSessionId: string,
  ): Promise<VoiceCallSession | null> {
    const s = this.voiceCallSessions.get(callSessionId);
    if (!s || s.organizationId !== organizationId) return null;
    return s;
  }

  async getVoiceCallSessionByExternalId(
    providerType: ChannelProviderType,
    externalCallId: string,
  ): Promise<VoiceCallSession | null> {
    for (const s of this.voiceCallSessions.values()) {
      if (s.providerType === providerType && s.externalCallId === externalCallId) return s;
    }
    return null;
  }

  async updateVoiceCallSessionStatus(
    organizationId: string,
    callSessionId: string,
    patch: UpdateVoiceCallSessionStatusInput,
  ): Promise<VoiceCallSession | null> {
    const s = await this.getVoiceCallSession(organizationId, callSessionId);
    if (!s) return null;
    const updated: VoiceCallSession = {
      ...s,
      status: patch.status ?? s.status,
      answeredAt: patch.answeredAt !== undefined ? patch.answeredAt : s.answeredAt,
      endedAt: patch.endedAt !== undefined ? patch.endedAt : s.endedAt,
      durationSeconds:
        patch.durationSeconds !== undefined ? patch.durationSeconds : s.durationSeconds,
      endReason: patch.endReason !== undefined ? patch.endReason : s.endReason,
      recordingStatus: patch.recordingStatus ?? s.recordingStatus,
      transcriptStatus: patch.transcriptStatus ?? s.transcriptStatus,
      externalCallId: patch.externalCallId !== undefined ? patch.externalCallId : s.externalCallId,
      metadata: patch.metadata ? { ...s.metadata, ...patch.metadata } : s.metadata,
      updatedAt: now(),
    };
    this.voiceCallSessions.set(updated.id, updated);
    return updated;
  }

  async endVoiceCallSession(
    organizationId: string,
    callSessionId: string,
    endReason: string,
  ): Promise<VoiceCallSession | null> {
    const s = await this.getVoiceCallSession(organizationId, callSessionId);
    if (!s) return null;
    const endedAt = now();
    const durationSeconds = Math.max(
      0,
      Math.round((new Date(endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000),
    );
    const updated: VoiceCallSession = {
      ...s,
      status: s.status === "failed" ? "failed" : "completed",
      endedAt,
      durationSeconds,
      endReason,
      transcriptStatus: s.transcriptStatus === "pending" ? "completed" : s.transcriptStatus,
      updatedAt: endedAt,
    };
    this.voiceCallSessions.set(updated.id, updated);
    return updated;
  }

  async createVoiceTranscriptMessage(
    input: CreateVoiceTranscriptMessageInput,
  ): Promise<VoiceTranscriptMessage> {
    const message: VoiceTranscriptMessage = {
      id: uuid(),
      organizationId: input.organizationId,
      employeeId: input.employeeId,
      channelId: input.channelId,
      callSessionId: input.callSessionId,
      speakerType: input.speakerType,
      content: input.content,
      confidence: input.confidence ?? null,
      startedAtMs: input.startedAtMs ?? null,
      endedAtMs: input.endedAtMs ?? null,
      sourceReferences: input.sourceReferences ?? null,
      modelProviderSlug: input.modelProviderSlug ?? null,
      modelId: input.modelId ?? null,
      estimatedCostUsd: input.estimatedCostUsd ?? null,
      metadata: input.metadata ?? {},
      createdAt: now(),
    };
    this.voiceTranscriptMessages.set(message.id, message);
    return message;
  }

  async listVoiceTranscriptMessages(
    organizationId: string,
    callSessionId: string,
  ): Promise<VoiceTranscriptMessage[]> {
    return [...this.voiceTranscriptMessages.values()]
      .filter((m) => m.organizationId === organizationId && m.callSessionId === callSessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async createVoiceStreamEvent(input: CreateVoiceStreamEventInput): Promise<VoiceStreamEvent> {
    const event: VoiceStreamEvent = {
      id: uuid(),
      organizationId: input.organizationId ?? null,
      employeeId: input.employeeId ?? null,
      channelId: input.channelId ?? null,
      callSessionId: input.callSessionId ?? null,
      providerType: input.providerType,
      eventType: input.eventType,
      status: input.status ?? "ok",
      metadata: input.metadata ?? {},
      createdAt: now(),
    };
    this.voiceStreamEvents.set(event.id, event);
    return event;
  }

  async listVoiceStreamEventsForCall(
    organizationId: string,
    callSessionId: string,
    limit = 50,
  ): Promise<VoiceStreamEvent[]> {
    return [...this.voiceStreamEvents.values()]
      .filter((e) => e.organizationId === organizationId && e.callSessionId === callSessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async getVoiceChannelOverview(
    organizationId: string,
    employeeId: string,
  ): Promise<VoiceChannelOverview> {
    const channels = await this.listEmployeeChannelsForEmployee(organizationId, employeeId);
    const channel =
      channels.find((c) => c.channelType === "phone_call" && c.status !== "archived") ?? null;
    let phoneNumber: VoicePhoneNumber | null = null;
    let credentialStatus: VoiceChannelOverview["credentialStatus"] = "not_configured";
    let recentCalls: VoiceCallSession[] = [];
    if (channel) {
      const numbers = await this.listVoicePhoneNumbersForChannel(organizationId, channel.id);
      phoneNumber = numbers[0] ?? null;
      const cred = await this.getChannelProviderCredentialMetadata(
        organizationId,
        channel.channelProvider,
      );
      credentialStatus = cred ? cred.status : "not_configured";
      recentCalls = [...this.voiceCallSessions.values()]
        .filter((s) => s.organizationId === organizationId && s.channelId === channel.id)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, 10);
    }
    return {
      channel,
      providerType: channel?.channelProvider ?? null,
      phoneNumber,
      credentialStatus,
      callCount: recentCalls.length,
      lastCallAt: recentCalls[0]?.startedAt ?? null,
      recentCalls,
    };
  }

  // --- Billing, Plans & Subscriptions (Sprint 015) --------------------------

  async getBillingSubscription(organizationId: string): Promise<BillingSubscription | null> {
    return this.billingSubscriptions.get(organizationId) ?? null;
  }

  async createBillingSubscription(
    input: CreateBillingSubscriptionInput,
  ): Promise<BillingSubscription> {
    const timestamp = now();
    const start = input.currentPeriodStart ?? timestamp;
    const subscription: BillingSubscription = {
      id: uuid(),
      organizationId: input.organizationId,
      planId: input.planId,
      status: input.status ?? "active",
      currentPeriodStart: start,
      currentPeriodEnd: input.currentPeriodEnd ?? addOneMonthIso(start),
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      externalSubscriptionId: input.externalSubscriptionId ?? null,
      externalCustomerId: input.externalCustomerId ?? null,
      provider: input.provider ?? "simulated",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    // Exactly one subscription per organization (keyed by org id).
    this.billingSubscriptions.set(subscription.organizationId, subscription);
    return subscription;
  }

  async updateBillingSubscription(
    organizationId: string,
    patch: UpdateBillingSubscriptionInput,
  ): Promise<BillingSubscription | null> {
    const existing = this.billingSubscriptions.get(organizationId);
    if (!existing) return null;
    const updated: BillingSubscription = {
      ...existing,
      ...("planId" in patch && patch.planId !== undefined ? { planId: patch.planId } : {}),
      ...("status" in patch && patch.status !== undefined ? { status: patch.status } : {}),
      ...("currentPeriodStart" in patch && patch.currentPeriodStart !== undefined
        ? { currentPeriodStart: patch.currentPeriodStart }
        : {}),
      ...("currentPeriodEnd" in patch && patch.currentPeriodEnd !== undefined
        ? { currentPeriodEnd: patch.currentPeriodEnd }
        : {}),
      ...("cancelAtPeriodEnd" in patch && patch.cancelAtPeriodEnd !== undefined
        ? { cancelAtPeriodEnd: patch.cancelAtPeriodEnd }
        : {}),
      ...("externalSubscriptionId" in patch
        ? { externalSubscriptionId: patch.externalSubscriptionId ?? null }
        : {}),
      ...("externalCustomerId" in patch
        ? { externalCustomerId: patch.externalCustomerId ?? null }
        : {}),
      ...("provider" in patch && patch.provider !== undefined ? { provider: patch.provider } : {}),
      updatedAt: now(),
    };
    this.billingSubscriptions.set(organizationId, updated);
    return updated;
  }

  async getBillingSubscriptionByExternalId(
    externalSubscriptionId: string,
  ): Promise<BillingSubscription | null> {
    for (const sub of this.billingSubscriptions.values()) {
      if (sub.externalSubscriptionId === externalSubscriptionId) return sub;
    }
    return null;
  }

  async getBillingCustomer(organizationId: string): Promise<BillingCustomer | null> {
    return this.billingCustomers.get(organizationId) ?? null;
  }

  async getBillingCustomerByExternalId(
    externalCustomerId: string,
  ): Promise<BillingCustomer | null> {
    for (const customer of this.billingCustomers.values()) {
      if (customer.externalCustomerId === externalCustomerId) return customer;
    }
    return null;
  }

  async upsertBillingCustomer(input: UpsertBillingCustomerInput): Promise<BillingCustomer> {
    const existing = this.billingCustomers.get(input.organizationId);
    const timestamp = now();
    const customer: BillingCustomer = {
      id: existing?.id ?? uuid(),
      organizationId: input.organizationId,
      externalCustomerId: input.externalCustomerId,
      provider: input.provider,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    this.billingCustomers.set(input.organizationId, customer);
    return customer;
  }

  async createBillingEvent(input: CreateBillingEventInput): Promise<BillingEvent> {
    const event: BillingEvent = {
      id: uuid(),
      organizationId: input.organizationId,
      eventType: input.eventType,
      planId: input.planId ?? null,
      status: input.status ?? null,
      provider: input.provider,
      metadata: input.metadata ?? {},
      createdAt: now(),
    };
    this.billingEvents.push(event);
    return event;
  }

  async listBillingEvents(organizationId: string, limit = 50): Promise<BillingEvent[]> {
    return this.billingEvents
      .filter((e) => e.organizationId === organizationId)
      .slice()
      .reverse()
      .slice(0, limit);
  }

  async countBillableInteractionsSince(organizationId: string, sinceIso: string): Promise<number> {
    return this.llmUsageEvents.filter(
      (e) =>
        e.organizationId === organizationId &&
        e.status !== "blocked" &&
        isBillableInteraction(e.taskType) &&
        e.createdAt >= sinceIso,
    ).length;
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

  async listAuditEvents(organizationId: string, limit = 50): Promise<AuditEvent[]> {
    return this.auditEvents
      .filter((e) => e.organizationId === organizationId)
      .slice()
      .reverse()
      .slice(0, limit);
  }

  async listAuditEventsForEmployee(
    organizationId: string,
    employeeId: string,
    limit = 20,
  ): Promise<AuditEvent[]> {
    return this.auditEvents
      .filter(
        (e) =>
          e.organizationId === organizationId &&
          ((e.targetType === "employee" && e.targetId === employeeId) ||
            (e.metadata as { employeeId?: unknown }).employeeId === employeeId),
      )
      .slice()
      .reverse()
      .slice(0, limit);
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
