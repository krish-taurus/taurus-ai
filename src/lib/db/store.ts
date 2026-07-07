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
  CreateEmployeeChannelInput,
  CreateEmployeeChatMessageInput,
  CreateEmployeeChatRetrievalEventInput,
  CreateEmployeeChatThreadInput,
  CreateMessagingTemplateInput,
  CreatePublicChannelEventInput,
  CreatePublicChatSessionInput,
  EmployeeChannel,
  GetOrCreatePublicChatSessionInput,
  MessagingChannelOverview,
  MessagingContactPreference,
  MessagingTemplate,
  MessagingTemplateStatus,
  PublicChannelEvent,
  PublicChatSession,
  UpdateChannelWebhookEventStatusInput,
  UpdateEmployeeChannelInput,
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
import type { Role } from "@/modules/organizations/roles";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { PostgresStore } from "@/lib/db/postgres-store";

export interface DataStore {
  // Users
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserBySupabaseAuthId(supabaseAuthUserId: string): Promise<User | null>;
  createUser(input: CreateUserInput): Promise<User>;
  /** Link an existing Taurus user to a Supabase Auth identity. */
  linkUserToSupabaseAuth(userId: string, supabaseAuthUserId: string): Promise<User>;

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
  /** Billable AI Employee interactions handled by one employee (all-time). */
  countInteractionsForEmployee(organizationId: string, employeeId: string): Promise<number>;

  getModelHubOverview(organizationId: string): Promise<ModelHubOverview>;

  // Employee Chat Runtime (Prompt 007) — all reads/writes organization-scoped.
  createEmployeeChatThread(input: CreateEmployeeChatThreadInput): Promise<EmployeeChatThread>;
  listEmployeeChatThreads(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeChatThread[]>;
  getEmployeeChatThread(
    organizationId: string,
    threadId: string,
  ): Promise<EmployeeChatThread | null>;
  getLatestEmployeeChatThreadForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeChatThread | null>;
  archiveEmployeeChatThread(
    organizationId: string,
    threadId: string,
  ): Promise<EmployeeChatThread | null>;

  createEmployeeChatMessage(input: CreateEmployeeChatMessageInput): Promise<EmployeeChatMessage>;
  listEmployeeChatMessages(
    organizationId: string,
    threadId: string,
  ): Promise<EmployeeChatMessage[]>;

  // Knowledge retrieval segments (internal excerpt store — never "chunks" in UI).
  createKnowledgeRetrievalSegments(
    inputs: CreateKnowledgeRetrievalSegmentInput[],
  ): Promise<KnowledgeRetrievalSegment[]>;
  listKnowledgeRetrievalSegmentsForSource(
    organizationId: string,
    knowledgeSourceId: string,
  ): Promise<KnowledgeRetrievalSegment[]>;
  listKnowledgeRetrievalSegmentsForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<KnowledgeRetrievalSegment[]>;
  searchKnowledgeRetrievalSegments(
    organizationId: string,
    employeeId: string,
    query: string,
    limit?: number,
  ): Promise<RankedRetrievalSegment[]>;
  deleteKnowledgeRetrievalSegmentsForSource(
    organizationId: string,
    knowledgeSourceId: string,
  ): Promise<number>;

  createEmployeeChatRetrievalEvent(
    input: CreateEmployeeChatRetrievalEventInput,
  ): Promise<EmployeeChatRetrievalEvent>;

  // Channels (Prompt 008). Dashboard reads/writes are organization-scoped; public
  // reads resolve the organization from the channel public key (never the client).
  createEmployeeChannel(input: CreateEmployeeChannelInput): Promise<EmployeeChannel>;
  listEmployeeChannelsForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeChannel[]>;
  /** All channels across every employee in the organization (Connections page). */
  listEmployeeChannelsForOrganization(organizationId: string): Promise<EmployeeChannel[]>;
  getEmployeeChannel(organizationId: string, channelId: string): Promise<EmployeeChannel | null>;
  /** Public resolver — not organization-scoped; returns the owning organization. */
  getEmployeeChannelByPublicKey(publicKey: string): Promise<EmployeeChannel | null>;
  updateEmployeeChannel(
    organizationId: string,
    channelId: string,
    patch: UpdateEmployeeChannelInput,
  ): Promise<EmployeeChannel | null>;
  activateEmployeeChannel(
    organizationId: string,
    channelId: string,
  ): Promise<EmployeeChannel | null>;
  pauseEmployeeChannel(organizationId: string, channelId: string): Promise<EmployeeChannel | null>;
  archiveEmployeeChannel(
    organizationId: string,
    channelId: string,
  ): Promise<EmployeeChannel | null>;

  createPublicChatSession(input: CreatePublicChatSessionInput): Promise<PublicChatSession>;
  /** Public: resolve a session within a channel (no organization from client). */
  getPublicChatSession(channelId: string, sessionId: string): Promise<PublicChatSession | null>;
  getOrCreatePublicChatSession(
    input: GetOrCreatePublicChatSessionInput,
  ): Promise<PublicChatSession>;

  createPublicChannelEvent(input: CreatePublicChannelEventInput): Promise<PublicChannelEvent>;
  listPublicChannelEventsForEmployee(
    organizationId: string,
    employeeId: string,
    limit?: number,
  ): Promise<PublicChannelEvent[]>;

  getChannelOverview(organizationId: string, employeeId: string): Promise<ChannelOverview>;

  // Messaging Channels (Prompt 009). Organization-scoped; credentials store only
  // encrypted blobs and metadata never includes the encrypted/plaintext secret.
  createChannelProviderCredential(
    input: CreateChannelProviderCredentialInput,
  ): Promise<ChannelProviderCredentialMetadata>;
  getChannelProviderCredentialMetadata(
    organizationId: string,
    providerType: ChannelProviderType,
  ): Promise<ChannelProviderCredentialMetadata | null>;
  listChannelProviderCredentials(
    organizationId: string,
  ): Promise<ChannelProviderCredentialMetadata[]>;
  /** Server-only: the encrypted blob for adapters to decrypt. Never client-facing. */
  getChannelProviderEncryptedCredentials(
    organizationId: string,
    providerType: ChannelProviderType,
  ): Promise<string | null>;
  disableChannelProviderCredential(
    organizationId: string,
    providerType: ChannelProviderType,
    userId?: string | null,
  ): Promise<ChannelProviderCredentialMetadata | null>;

  createChannelWebhookEvent(input: CreateChannelWebhookEventInput): Promise<ChannelWebhookEvent>;
  updateChannelWebhookEventStatus(
    id: string,
    input: UpdateChannelWebhookEventStatusInput,
  ): Promise<ChannelWebhookEvent | null>;
  listChannelWebhookEventsForChannel(
    organizationId: string,
    channelId: string,
    limit?: number,
  ): Promise<ChannelWebhookEvent[]>;

  createMessagingTemplate(input: CreateMessagingTemplateInput): Promise<MessagingTemplate>;
  listMessagingTemplates(
    organizationId: string,
    channelId?: string | null,
  ): Promise<MessagingTemplate[]>;
  updateMessagingTemplateStatus(
    organizationId: string,
    templateId: string,
    status: MessagingTemplateStatus,
  ): Promise<MessagingTemplate | null>;

  getMessagingContactPreference(
    organizationId: string,
    channelId: string,
    normalizedContactHash: string,
  ): Promise<MessagingContactPreference | null>;
  upsertMessagingContactPreference(
    input: UpsertMessagingContactPreferenceInput,
  ): Promise<MessagingContactPreference>;
  blockMessagingContact(
    organizationId: string,
    channelId: string,
    normalizedContactHash: string,
    userId?: string | null,
  ): Promise<MessagingContactPreference | null>;

  getMessagingChannelOverview(
    organizationId: string,
    employeeId: string,
  ): Promise<MessagingChannelOverview>;

  // Voice Call Channel (Prompt 010). Organization-scoped; public webhooks resolve
  // via the channel public key. Caller numbers are hashed; no raw audio is stored.
  createVoicePhoneNumber(input: CreateVoicePhoneNumberInput): Promise<VoicePhoneNumber>;
  listVoicePhoneNumbersForChannel(
    organizationId: string,
    channelId: string,
  ): Promise<VoicePhoneNumber[]>;
  getVoicePhoneNumber(
    organizationId: string,
    phoneNumberId: string,
  ): Promise<VoicePhoneNumber | null>;
  updateVoicePhoneNumber(
    organizationId: string,
    phoneNumberId: string,
    patch: UpdateVoicePhoneNumberInput,
  ): Promise<VoicePhoneNumber | null>;
  archiveVoicePhoneNumber(
    organizationId: string,
    phoneNumberId: string,
  ): Promise<VoicePhoneNumber | null>;

  createVoiceCallSession(input: CreateVoiceCallSessionInput): Promise<VoiceCallSession>;
  getVoiceCallSession(
    organizationId: string,
    callSessionId: string,
  ): Promise<VoiceCallSession | null>;
  /** Public resolver by provider + external id (never client-supplied org). */
  getVoiceCallSessionByExternalId(
    providerType: ChannelProviderType,
    externalCallId: string,
  ): Promise<VoiceCallSession | null>;
  updateVoiceCallSessionStatus(
    organizationId: string,
    callSessionId: string,
    patch: UpdateVoiceCallSessionStatusInput,
  ): Promise<VoiceCallSession | null>;
  endVoiceCallSession(
    organizationId: string,
    callSessionId: string,
    endReason: string,
  ): Promise<VoiceCallSession | null>;

  createVoiceTranscriptMessage(
    input: CreateVoiceTranscriptMessageInput,
  ): Promise<VoiceTranscriptMessage>;
  listVoiceTranscriptMessages(
    organizationId: string,
    callSessionId: string,
  ): Promise<VoiceTranscriptMessage[]>;

  createVoiceStreamEvent(input: CreateVoiceStreamEventInput): Promise<VoiceStreamEvent>;
  listVoiceStreamEventsForCall(
    organizationId: string,
    callSessionId: string,
    limit?: number,
  ): Promise<VoiceStreamEvent[]>;

  getVoiceChannelOverview(
    organizationId: string,
    employeeId: string,
  ): Promise<VoiceChannelOverview>;

  // Billing, Plans & Subscriptions (Prompt 011) — organization-scoped. Exactly
  // one active subscription per organization; a Starter subscription is created
  // implicitly when the organization is created.
  getBillingSubscription(organizationId: string): Promise<BillingSubscription | null>;
  createBillingSubscription(input: CreateBillingSubscriptionInput): Promise<BillingSubscription>;
  updateBillingSubscription(
    organizationId: string,
    patch: UpdateBillingSubscriptionInput,
  ): Promise<BillingSubscription | null>;

  getBillingCustomer(organizationId: string): Promise<BillingCustomer | null>;
  /** Resolve the organization from a stored external customer id (webhook path). */
  getBillingCustomerByExternalId(externalCustomerId: string): Promise<BillingCustomer | null>;
  /** Resolve the organization from a stored external subscription id (webhook path). */
  getBillingSubscriptionByExternalId(
    externalSubscriptionId: string,
  ): Promise<BillingSubscription | null>;
  upsertBillingCustomer(input: UpsertBillingCustomerInput): Promise<BillingCustomer>;

  createBillingEvent(input: CreateBillingEventInput): Promise<BillingEvent>;
  listBillingEvents(organizationId: string, limit?: number): Promise<BillingEvent[]>;

  /** Count billable AI Employee interactions since a timestamp (derived quota). */
  countBillableInteractionsSince(organizationId: string, sinceIso: string): Promise<number>;

  // Audit — organization-scoped. Events are written at mutation sites; this is
  // the read path for the Audit dashboard (metadata only, most recent first).
  createAuditEvent(input: AuditEventInput): Promise<AuditEvent>;
  listAuditEvents(organizationId: string, limit?: number): Promise<AuditEvent[]>;
  /** Recent audit events involving one employee (as target or via metadata.employeeId). */
  listAuditEventsForEmployee(
    organizationId: string,
    employeeId: string,
    limit?: number,
  ): Promise<AuditEvent[]>;
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
