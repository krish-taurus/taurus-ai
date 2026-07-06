/**
 * Data store abstraction (Prompt 002).
 *
 * The application talks to a `DataStore`, never directly to a database driver.
 * Two implementations exist:
 *   - InMemoryStore   — used when DATABASE_URL is unset (local dev + tests).
 *   - PostgresStore   — used when DATABASE_URL is set (real PostgreSQL).
 *
 * This keeps tenant-isolation logic testable without a live database while still
 * shipping a real PostgreSQL foundation.
 */

import type {
  AiEmployee,
  ArchiveDnaVersionInput,
  AssignKnowledgeInput,
  AuditEvent,
  AuditEventInput,
  CreateEmployeeInput,
  CreateKnowledgeDocumentInput,
  CreateKnowledgeSourceInput,
  CreateLlmUsageEventInput,
  CreateOrganizationInput,
  CreateUserInput,
  EmployeeDnaOverview,
  EmployeeDnaVersion,
  EmployeeKnowledgeAssignment,
  EmployeeModelSettings,
  KnowledgeDocument,
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
  SaveDnaDraftInput,
  SaveProviderCredentialInput,
  UpdateEmployeeInput,
  UpdateEmployeeModelSettingsInput,
  UpdateKnowledgeSourceInput,
  UpdateOrganizationModelSettingsInput,
  User,
} from "@/lib/db/types";
import type { AiModel, ModelProvider } from "@/modules/model-gateway/types";
import type { Role } from "@/modules/organizations/roles";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { PostgresStore } from "@/lib/db/postgres-store";

export interface DataStore {
  // Users
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(input: CreateUserInput): Promise<User>;

  // Organizations + memberships
  getOrganizationById(id: string): Promise<Organization | null>;
  getOrganizationBySlug(slug: string): Promise<Organization | null>;
  listOrganizationsForUser(userId: string): Promise<OrganizationMembershipView[]>;
  getMembership(organizationId: string, userId: string): Promise<OrganizationMember | null>;

  /**
   * Atomically create an organization and its owner membership. Returns both.
   * Implementations must ensure the owner membership is created for the org.
   */
  createOrganizationWithOwner(input: {
    organization: CreateOrganizationInput;
    ownerUserId: string;
    ownerRole?: Role;
  }): Promise<OrganizationMembershipView>;

  // AI Employees (Prompt 003) — all reads/writes are organization-scoped.
  createEmployee(input: CreateEmployeeInput): Promise<AiEmployee>;
  listEmployees(organizationId: string): Promise<AiEmployee[]>;
  getEmployee(organizationId: string, employeeId: string): Promise<AiEmployee | null>;
  updateEmployee(
    organizationId: string,
    employeeId: string,
    patch: UpdateEmployeeInput,
  ): Promise<AiEmployee | null>;

  /** Tenant-isolation seam: which organization owns this employee (or null). */
  getEmployeeOrganizationId(employeeId: string): Promise<string | null>;

  // Employee DNA (Prompt 005) — all reads/writes are organization-scoped.
  getEmployeeDnaOverview(organizationId: string, employeeId: string): Promise<EmployeeDnaOverview>;
  getDraftEmployeeDna(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDnaVersion | null>;
  getPublishedEmployeeDna(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDnaVersion | null>;
  listEmployeeDnaVersions(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDnaVersion[]>;
  /** Upsert the single draft: updates it if present, else creates the next version. */
  saveEmployeeDnaDraft(input: SaveDnaDraftInput): Promise<EmployeeDnaVersion>;
  /** Promote the current draft to published, archiving any previously published. */
  publishEmployeeDna(input: PublishDnaInput): Promise<EmployeeDnaVersion>;
  archiveEmployeeDnaVersion(input: ArchiveDnaVersionInput): Promise<EmployeeDnaVersion | null>;

  // Knowledge Vault (Prompt 006) — all reads/writes are organization-scoped.
  createKnowledgeSource(input: CreateKnowledgeSourceInput): Promise<KnowledgeSource>;
  listKnowledgeSources(organizationId: string): Promise<KnowledgeSource[]>;
  getKnowledgeSource(organizationId: string, sourceId: string): Promise<KnowledgeSource | null>;
  updateKnowledgeSource(
    organizationId: string,
    sourceId: string,
    patch: UpdateKnowledgeSourceInput,
  ): Promise<KnowledgeSource | null>;
  archiveKnowledgeSource(organizationId: string, sourceId: string): Promise<KnowledgeSource | null>;

  createKnowledgeDocument(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocument>;
  listKnowledgeDocumentsForSource(
    organizationId: string,
    sourceId: string,
  ): Promise<KnowledgeDocument[]>;
  getKnowledgeDocument(
    organizationId: string,
    documentId: string,
  ): Promise<KnowledgeDocument | null>;

  assignKnowledgeSourceToEmployee(
    input: AssignKnowledgeInput,
  ): Promise<EmployeeKnowledgeAssignment>;
  unassignKnowledgeSourceFromEmployee(
    organizationId: string,
    employeeId: string,
    knowledgeSourceId: string,
  ): Promise<boolean>;
  listKnowledgeSourcesForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<KnowledgeSource[]>;
  listEmployeesForKnowledgeSource(
    organizationId: string,
    knowledgeSourceId: string,
  ): Promise<AiEmployee[]>;
  countAssignedKnowledgeForEmployee(organizationId: string, employeeId: string): Promise<number>;

  getKnowledgeVaultOverview(organizationId: string): Promise<KnowledgeVaultOverview>;

  // Model Hub + LLM Gateway (Prompt 006B).
  // Catalog (code-authoritative; not organization-scoped).
  listModelProviders(): Promise<ModelProvider[]>;
  listAiModels(): Promise<AiModel[]>;
  getAiModel(modelId: string): Promise<AiModel | null>;
  getModelsByProvider(providerSlug: ProviderSlug): Promise<AiModel[]>;

  // Organization + employee model settings — organization-scoped.
  getOrganizationModelSettings(organizationId: string): Promise<OrganizationModelSettings>;
  updateOrganizationModelSettings(
    organizationId: string,
    patch: UpdateOrganizationModelSettingsInput,
  ): Promise<OrganizationModelSettings>;
  getEmployeeModelSettings(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeModelSettings | null>;
  updateEmployeeModelSettings(
    organizationId: string,
    employeeId: string,
    patch: UpdateEmployeeModelSettingsInput,
  ): Promise<EmployeeModelSettings>;

  // Provider credentials — metadata never includes the encrypted/plaintext key.
  getProviderCredentialMetadata(
    organizationId: string,
    providerSlug: ProviderSlug,
  ): Promise<ProviderCredentialMetadata | null>;
  listProviderCredentialMetadata(organizationId: string): Promise<ProviderCredentialMetadata[]>;
  /** Server-only: the encrypted key for the gateway to decrypt. Never client-facing. */
  getProviderEncryptedKey(
    organizationId: string,
    providerSlug: ProviderSlug,
  ): Promise<string | null>;
  saveProviderCredential(input: SaveProviderCredentialInput): Promise<ProviderCredentialMetadata>;
  disableProviderCredential(
    organizationId: string,
    providerSlug: ProviderSlug,
    userId?: string | null,
  ): Promise<ProviderCredentialMetadata | null>;

  // Usage events — metadata only (never message contents).
  listLlmUsageEvents(organizationId: string, limit?: number): Promise<LlmUsageEvent[]>;
  createLlmUsageEvent(input: CreateLlmUsageEventInput): Promise<LlmUsageEvent>;

  getModelHubOverview(organizationId: string): Promise<ModelHubOverview>;

  // Audit
  createAuditEvent(input: AuditEventInput): Promise<AuditEvent>;
}

/**
 * The store is pinned on globalThis (not a module-level `let`) so it survives
 * module re-evaluation. In Next.js dev, on-demand route compilation and HMR can
 * create fresh module instances; a plain module singleton would then hand
 * different requests different in-memory stores, losing data written by a prior
 * request (e.g. a user created during sign-up). globalThis guarantees a single
 * instance across the whole server process.
 */
const globalForStore = globalThis as unknown as { __taurusStore?: DataStore };

/**
 * Returns the process-wide data store, selecting the backend from the
 * environment. This module is imported only by server code (guards, server
 * actions), never by client or edge/middleware code, so the pg driver never
 * reaches the browser or the edge runtime.
 */
export function getStore(): DataStore {
  if (!globalForStore.__taurusStore) {
    globalForStore.__taurusStore = process.env.DATABASE_URL
      ? new PostgresStore()
      : new InMemoryStore();
  }
  return globalForStore.__taurusStore;
}

/** Test helper: reset the cached store between tests. */
export function __resetStoreForTests(store?: DataStore): void {
  globalForStore.__taurusStore = store;
}
