/**
 * PostgreSQL-backed DataStore (Prompt 002).
 *
 * Used when DATABASE_URL is set. Every method maps snake_case columns to the
 * camelCase entity types. Tenant isolation is enforced by callers via the
 * security guards; this layer only executes scoped queries.
 *
 * NOTE: exercising this path requires a live PostgreSQL with the migrations in
 * db/migrations applied. The in-memory store is used for local dev/tests.
 */

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/pool";
import type { DataStore } from "@/lib/db/store";
import type {
  AiEmployee,
  ArchiveDnaVersionInput,
  AssignKnowledgeInput,
  AuditEvent,
  AuditEventInput,
  ChannelAppearance,
  ChannelCredentialMode,
  ChannelCredentialStatus,
  ChannelOverview,
  ChannelProviderCredentialMetadata,
  ChannelProviderType,
  ChannelStatus,
  ChannelType,
  ChannelWebhookEvent,
  ChannelWebhookEventStatus,
  ChannelWebhookEventType,
  CreateChannelProviderCredentialInput,
  CreateChannelWebhookEventInput,
  CreateMessagingTemplateInput,
  MessageOptInStatus,
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
  VoicePhoneNumberStatus,
  VoiceCallSession,
  VoiceCallDirection,
  VoiceCallStatus,
  VoiceRecordingStatus,
  VoiceTranscriptStatus,
  VoiceTranscriptMessage,
  VoiceSpeakerType,
  VoiceStreamEvent,
  VoiceStreamEventType,
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
  PublicChannelEventType,
  PublicChatSession,
  PublicChatSessionStatus,
  UpdateEmployeeChannelInput,
  CreateEmployeeInput,
  CreateKnowledgeDocumentInput,
  CreateKnowledgeRetrievalSegmentInput,
  CreateKnowledgeSourceInput,
  CreateLlmUsageEventInput,
  CreateOrganizationInput,
  CreateUserInput,
  CredentialMode,
  CredentialStatus,
  ChatMessageRole,
  ChatMessageStatus,
  ChatThreadStatus,
  BrainMode,
  ChatSourceReference,
  DnaStatus,
  DocumentExtractionStatus,
  EmployeeChatMessage,
  EmployeeChatRetrievalEvent,
  EmployeeChatThread,
  EmployeeDnaOverview,
  EmployeeDnaVersion,
  EmployeeKnowledgeAssignment,
  EmployeeModelSettings,
  EmployeeStatus,
  EmployeeVisibility,
  KnowledgeDocument,
  KnowledgeRetrievalSegment,
  KnowledgeSource,
  KnowledgeSourceStatus,
  KnowledgeSourceType,
  KnowledgeVaultOverview,
  KnowledgeVisibility,
  LlmTaskType,
  LlmUsageEvent,
  LlmUsageStatus,
  ModelHubOverview,
  Organization,
  OrganizationMember,
  OrganizationMembershipView,
  OrganizationModelSettings,
  ProviderCredentialMetadata,
  ProviderSlug,
  PublishDnaInput,
  RankedRetrievalSegment,
  RetrievalSegmentStatus,
  RoutingMode,
  SaveDnaDraftInput,
  SaveProviderCredentialInput,
  UpdateEmployeeInput,
  UpdateEmployeeModelSettingsInput,
  UpdateKnowledgeSourceInput,
  UpdateOrganizationModelSettingsInput,
  User,
  WorkingStyle,
} from "@/lib/db/types";
import type { AiModel, ModelProvider } from "@/modules/model-gateway/types";
import {
  AI_MODELS,
  MODEL_PROVIDERS,
  getModel,
  modelsByProvider,
} from "@/modules/model-gateway/catalog";
import { rankSegments } from "@/modules/employee-chat/scoring";
import { isRole, type Role } from "@/modules/organizations/roles";
import type { EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import { DNA_SCHEMA_VERSION } from "@/modules/employee-dna/schema";

// Row shapes come from pg as untyped records; map them explicitly below.
type Row = Record<string, any>;

function mapUser(row: Row): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapOrganization(row: Row): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    industry: row.industry,
    websiteUrl: row.website_url,
    sizeRange: row.size_range,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapMembership(row: Row): OrganizationMember {
  const role: Role = isRole(row.role) ? row.role : "viewer";
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    role,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapEmployee(row: Row): AiEmployee {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    roleTitle: row.role_title,
    department: row.department,
    description: row.description,
    status: row.status as EmployeeStatus,
    visibility: row.visibility as EmployeeVisibility,
    responsibilities: Array.isArray(row.responsibilities) ? row.responsibilities : [],
    workingStyle: (row.working_style as WorkingStyle | null) ?? null,
    avatarUrl: row.avatar_url,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapDnaVersion(row: Row): EmployeeDnaVersion {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    versionNumber: row.version_number,
    status: row.status as DnaStatus,
    schemaVersion: row.schema_version,
    dna: row.dna as EmployeeDnaV1,
    createdByUserId: row.created_by_user_id,
    publishedByUserId: row.published_by_user_id,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapKnowledgeSource(row: Row): KnowledgeSource {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    sourceType: row.source_type as KnowledgeSourceType,
    status: row.status as KnowledgeSourceStatus,
    visibility: row.visibility as KnowledgeVisibility,
    createdByUserId: row.created_by_user_id,
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapKnowledgeDocument(row: Row): KnowledgeDocument {
  return {
    id: row.id,
    organizationId: row.organization_id,
    knowledgeSourceId: row.knowledge_source_id,
    title: row.title,
    originalFilename: row.original_filename,
    contentType: row.content_type,
    byteSize: row.byte_size,
    checksumSha256: row.checksum_sha256,
    storageKey: row.storage_key,
    textContent: row.text_content,
    textPreview: row.text_preview,
    extractionStatus: row.extraction_status as DocumentExtractionStatus,
    extractionError: row.extraction_error,
    createdByUserId: row.created_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapKnowledgeAssignment(row: Row): EmployeeKnowledgeAssignment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    knowledgeSourceId: row.knowledge_source_id,
    assignedByUserId: row.assigned_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function slugArray(value: unknown): ProviderSlug[] {
  return Array.isArray(value) ? (value as ProviderSlug[]) : [];
}

function mapOrgModelSettings(row: Row): OrganizationModelSettings {
  return {
    id: row.id,
    organizationId: row.organization_id,
    defaultModelId: row.default_model_id,
    routingMode: row.routing_mode as RoutingMode,
    allowedProviderSlugs: slugArray(row.allowed_provider_slugs),
    blockedProviderSlugs: slugArray(row.blocked_provider_slugs),
    monthlyBudgetUsd: num(row.monthly_budget_usd),
    budgetAlertThresholdPercent: num(row.budget_alert_threshold_percent),
    fallbackModelId: row.fallback_model_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapEmployeeModelSettings(row: Row): EmployeeModelSettings {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    modelId: row.model_id,
    routingMode: (row.routing_mode as RoutingMode | null) ?? null,
    maxMonthlyBudgetUsd: num(row.max_monthly_budget_usd),
    fallbackModelId: row.fallback_model_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** Maps a credential row to client-safe metadata — the encrypted key is dropped. */
function mapCredentialMetadata(row: Row): ProviderCredentialMetadata {
  return {
    id: row.id,
    organizationId: row.organization_id,
    providerSlug: row.provider_slug as ProviderSlug,
    credentialMode: row.credential_mode as CredentialMode,
    keyLastFour: row.key_last_four,
    status: row.status as CredentialStatus,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapUsageEvent(row: Row): LlmUsageEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    providerSlug: row.provider_slug as ProviderSlug,
    modelId: row.model_id,
    taskType: row.task_type as LlmTaskType,
    inputTokens: row.input_tokens,
    cachedInputTokens: row.cached_input_tokens,
    outputTokens: row.output_tokens,
    estimatedCostUsd: num(row.estimated_cost_usd),
    latencyMs: row.latency_ms,
    status: row.status as LlmUsageStatus,
    errorCode: row.error_code,
    requestIdHash: row.request_id_hash,
    createdByUserId: row.created_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapChatThread(row: Row): EmployeeChatThread {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    title: row.title,
    status: row.status as ChatThreadStatus,
    createdByUserId: row.created_by_user_id,
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapChatMessage(row: Row): EmployeeChatMessage {
  return {
    id: row.id,
    organizationId: row.organization_id,
    threadId: row.thread_id,
    employeeId: row.employee_id,
    role: row.role as ChatMessageRole,
    content: row.content,
    status: row.status as ChatMessageStatus,
    sourceReferences: (row.source_references as ChatSourceReference[] | null) ?? null,
    modelProviderSlug: row.model_provider_slug,
    modelId: row.model_id,
    modelTier: row.model_tier,
    routingMode: row.routing_mode,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    estimatedCostUsd: num(row.estimated_cost_usd),
    latencyMs: row.latency_ms,
    errorCode: row.error_code,
    brainMode: (row.brain_mode as BrainMode | null) ?? null,
    createdByUserId: row.created_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapRetrievalSegment(row: Row): KnowledgeRetrievalSegment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    knowledgeSourceId: row.knowledge_source_id,
    knowledgeDocumentId: row.knowledge_document_id,
    title: row.title,
    content: row.content,
    contentPreview: row.content_preview,
    segmentIndex: row.segment_index,
    status: row.status as RetrievalSegmentStatus,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapChatRetrievalEvent(row: Row): EmployeeChatRetrievalEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    threadId: row.thread_id,
    messageId: row.message_id,
    queryTextHash: row.query_text_hash,
    retrievedSourceCount: row.retrieved_source_count,
    topSourceIds: Array.isArray(row.top_source_ids) ? row.top_source_ids : [],
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapChannelAppearance(raw: unknown): ChannelAppearance {
  const a = (raw ?? {}) as Partial<ChannelAppearance>;
  return {
    theme: a.theme === "light" ? "light" : "dark",
    position: a.position === "bottom-left" ? "bottom-left" : "bottom-right",
    launcherLabel: typeof a.launcherLabel === "string" ? a.launcherLabel : "Chat with us",
    employeeDisplayName:
      typeof a.employeeDisplayName === "string" ? a.employeeDisplayName : "AI Employee",
    accentStyle: a.accentStyle === "solid" ? "solid" : "mono",
    showSources: a.showSources !== false,
    collectVisitorEmail: a.collectVisitorEmail === true,
    brandName: typeof a.brandName === "string" ? a.brandName : null,
  };
}

function mapChannel(row: Row): EmployeeChannel {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    channelType: row.channel_type as ChannelType,
    channelProvider: row.channel_provider as ChannelProviderType,
    publicKey: row.public_key,
    hasSecret: !!row.secret_hash,
    name: row.name,
    status: row.status as ChannelStatus,
    allowedDomains: Array.isArray(row.allowed_domains) ? row.allowed_domains : [],
    appearance: mapChannelAppearance(row.appearance),
    providerConfig: (row.provider_config as Record<string, unknown>) ?? {},
    welcomeMessage: row.welcome_message,
    rateLimitPerMinute: row.rate_limit_per_minute,
    rateLimitPerDay: row.rate_limit_per_day,
    createdByUserId: row.created_by_user_id,
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapPublicSession(row: Row): PublicChatSession {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    channelId: row.channel_id,
    threadId: row.thread_id,
    visitorId: row.visitor_id,
    visitorLabel: row.visitor_label,
    originDomain: row.origin_domain,
    userAgentHash: row.user_agent_hash,
    ipHash: row.ip_hash,
    status: row.status as PublicChatSessionStatus,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
  };
}

function mapChannelEvent(row: Row): PublicChannelEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    channelId: row.channel_id,
    eventType: row.event_type as PublicChannelEventType,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** Maps a provider credential row to client-safe metadata (encrypted blob dropped). */
function mapProviderCredential(row: Row): ChannelProviderCredentialMetadata {
  return {
    id: row.id,
    organizationId: row.organization_id,
    providerType: row.provider_type as ChannelProviderType,
    credentialMode: row.credential_mode as ChannelCredentialMode,
    credentialLabel: row.credential_label,
    keyLastFour: row.key_last_four,
    hasSecret: !!row.has_secret,
    status: row.status as ChannelCredentialStatus,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapWebhookEvent(row: Row): ChannelWebhookEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    channelId: row.channel_id,
    providerType: row.provider_type as ChannelProviderType,
    eventType: row.event_type as ChannelWebhookEventType,
    externalEventId: row.external_event_id,
    status: row.status as ChannelWebhookEventStatus,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    receivedAt: new Date(row.received_at).toISOString(),
    processedAt: row.processed_at ? new Date(row.processed_at).toISOString() : null,
    errorCode: row.error_code,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapMessagingTemplate(row: Row): MessagingTemplate {
  return {
    id: row.id,
    organizationId: row.organization_id,
    channelId: row.channel_id,
    providerType: row.provider_type as ChannelProviderType,
    templateName: row.template_name,
    templateCategory: row.template_category,
    language: row.language,
    status: row.status as MessagingTemplateStatus,
    externalTemplateId: row.external_template_id,
    bodyPreview: row.body_preview,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdByUserId: row.created_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapContactPreference(row: Row): MessagingContactPreference {
  return {
    id: row.id,
    organizationId: row.organization_id,
    channelId: row.channel_id,
    externalContactId: row.external_contact_id,
    normalizedContactHash: row.normalized_contact_hash,
    channelType: row.channel_type as ChannelType,
    optInStatus: row.opt_in_status as MessageOptInStatus,
    blockedAt: row.blocked_at ? new Date(row.blocked_at).toISOString() : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapVoicePhoneNumber(row: Row): VoicePhoneNumber {
  return {
    id: row.id,
    organizationId: row.organization_id,
    channelId: row.channel_id,
    providerType: row.provider_type as ChannelProviderType,
    phoneNumber: row.phone_number,
    displayLabel: row.display_label,
    externalPhoneNumberId: row.external_phone_number_id,
    countryCode: row.country_code,
    capabilities: (row.capabilities as Record<string, unknown>) ?? {},
    status: row.status as VoicePhoneNumberStatus,
    createdByUserId: row.created_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
  };
}

function mapVoiceCall(row: Row): VoiceCallSession {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    channelId: row.channel_id,
    phoneNumberId: row.phone_number_id,
    providerType: row.provider_type as ChannelProviderType,
    externalCallId: row.external_call_id,
    direction: row.direction as VoiceCallDirection,
    callerHash: row.caller_hash,
    callerLabel: row.caller_label,
    status: row.status as VoiceCallStatus,
    startedAt: new Date(row.started_at).toISOString(),
    answeredAt: row.answered_at ? new Date(row.answered_at).toISOString() : null,
    endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : null,
    durationSeconds: row.duration_seconds,
    endReason: row.end_reason,
    recordingStatus: row.recording_status as VoiceRecordingStatus,
    transcriptStatus: row.transcript_status as VoiceTranscriptStatus,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapVoiceTranscript(row: Row): VoiceTranscriptMessage {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    channelId: row.channel_id,
    callSessionId: row.call_session_id,
    speakerType: row.speaker_type as VoiceSpeakerType,
    content: row.content,
    confidence: num(row.confidence),
    startedAtMs: row.started_at_ms,
    endedAtMs: row.ended_at_ms,
    sourceReferences: (row.source_references as ChatSourceReference[] | null) ?? null,
    modelProviderSlug: row.model_provider_slug,
    modelId: row.model_id,
    estimatedCostUsd: num(row.estimated_cost_usd),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapVoiceStreamEvent(row: Row): VoiceStreamEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    channelId: row.channel_id,
    callSessionId: row.call_session_id,
    providerType: row.provider_type as ChannelProviderType,
    eventType: row.event_type as VoiceStreamEventType,
    status: row.status,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export class PostgresStore implements DataStore {
  private query(text: string, params?: unknown[]) {
    return getPool().query(text, params as any[]);
  }

  async getUserById(id: string): Promise<User | null> {
    const { rows } = await this.query("select * from users where id = $1", [id]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const { rows } = await this.query("select * from users where email = $1", [
      email.trim().toLowerCase(),
    ]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const { rows } = await this.query(
      "insert into users (email, full_name) values ($1, $2) returning *",
      [input.email.trim().toLowerCase(), input.fullName?.trim() || null],
    );
    return mapUser(rows[0]);
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    const { rows } = await this.query("select * from organizations where id = $1", [id]);
    return rows[0] ? mapOrganization(rows[0]) : null;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const { rows } = await this.query("select * from organizations where slug = $1", [slug]);
    return rows[0] ? mapOrganization(rows[0]) : null;
  }

  async listOrganizationsForUser(userId: string): Promise<OrganizationMembershipView[]> {
    const { rows } = await this.query(
      `select
         o.id as o_id, o.name, o.slug, o.industry, o.website_url, o.size_range,
         o.created_at as o_created_at, o.updated_at as o_updated_at,
         m.id as m_id, m.organization_id, m.user_id, m.role, m.status,
         m.created_at as m_created_at, m.updated_at as m_updated_at
       from organization_members m
       join organizations o on o.id = m.organization_id
       where m.user_id = $1
       order by o.name asc`,
      [userId],
    );
    return rows.map((row: Row) => ({
      organization: mapOrganization({
        id: row.o_id,
        name: row.name,
        slug: row.slug,
        industry: row.industry,
        website_url: row.website_url,
        size_range: row.size_range,
        created_at: row.o_created_at,
        updated_at: row.o_updated_at,
      }),
      membership: mapMembership({
        id: row.m_id,
        organization_id: row.organization_id,
        user_id: row.user_id,
        role: row.role,
        status: row.status,
        created_at: row.m_created_at,
        updated_at: row.m_updated_at,
      }),
    }));
  }

  async getMembership(organizationId: string, userId: string): Promise<OrganizationMember | null> {
    const { rows } = await this.query(
      "select * from organization_members where organization_id = $1 and user_id = $2",
      [organizationId, userId],
    );
    return rows[0] ? mapMembership(rows[0]) : null;
  }

  async createOrganizationWithOwner(input: {
    organization: CreateOrganizationInput;
    ownerUserId: string;
    ownerRole?: Role;
  }): Promise<OrganizationMembershipView> {
    const client: PoolClient = await getPool().connect();
    try {
      await client.query("begin");
      const orgResult = await client.query(
        `insert into organizations (name, slug, industry, website_url, size_range)
         values ($1, $2, $3, $4, $5) returning *`,
        [
          input.organization.name,
          input.organization.slug,
          input.organization.industry ?? null,
          input.organization.websiteUrl ?? null,
          input.organization.sizeRange ?? null,
        ],
      );
      const organization = mapOrganization(orgResult.rows[0]);

      const memberResult = await client.query(
        `insert into organization_members (organization_id, user_id, role, status)
         values ($1, $2, $3, 'active') returning *`,
        [organization.id, input.ownerUserId, input.ownerRole ?? "owner"],
      );
      const membership = mapMembership(memberResult.rows[0]);

      await client.query("commit");
      return { organization, membership };
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }

  async createEmployee(input: CreateEmployeeInput): Promise<AiEmployee> {
    const { rows } = await this.query(
      `insert into ai_employees
         (organization_id, name, role_title, department, description, status, visibility,
          responsibilities, working_style, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning *`,
      [
        input.organizationId,
        input.name,
        input.roleTitle,
        input.department ?? null,
        input.description ?? null,
        input.status ?? "draft",
        input.visibility ?? "private",
        JSON.stringify(input.responsibilities ?? []),
        input.workingStyle ? JSON.stringify(input.workingStyle) : null,
        input.createdBy ?? null,
      ],
    );
    return mapEmployee(rows[0]);
  }

  async listEmployees(organizationId: string): Promise<AiEmployee[]> {
    const { rows } = await this.query(
      "select * from ai_employees where organization_id = $1 order by updated_at desc",
      [organizationId],
    );
    return rows.map(mapEmployee);
  }

  async getEmployee(organizationId: string, employeeId: string): Promise<AiEmployee | null> {
    // Organization scoping is part of the WHERE clause: an employee id from
    // another organization simply returns no row.
    const { rows } = await this.query(
      "select * from ai_employees where id = $1 and organization_id = $2",
      [employeeId, organizationId],
    );
    return rows[0] ? mapEmployee(rows[0]) : null;
  }

  async updateEmployee(
    organizationId: string,
    employeeId: string,
    patch: UpdateEmployeeInput,
  ): Promise<AiEmployee | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const add = (column: string, value: unknown) => {
      sets.push(`${column} = $${i++}`);
      values.push(value);
    };

    if (patch.name !== undefined) add("name", patch.name);
    if (patch.roleTitle !== undefined) add("role_title", patch.roleTitle);
    if ("department" in patch) add("department", patch.department ?? null);
    if ("description" in patch) add("description", patch.description ?? null);
    if (patch.status !== undefined) add("status", patch.status);
    if (patch.visibility !== undefined) add("visibility", patch.visibility);

    if (sets.length === 0) return this.getEmployee(organizationId, employeeId);

    sets.push("updated_at = now()");
    values.push(employeeId, organizationId);
    const { rows } = await this.query(
      `update ai_employees set ${sets.join(", ")}
       where id = $${i++} and organization_id = $${i} returning *`,
      values,
    );
    return rows[0] ? mapEmployee(rows[0]) : null;
  }

  async getEmployeeOrganizationId(employeeId: string): Promise<string | null> {
    const { rows } = await this.query("select organization_id from ai_employees where id = $1", [
      employeeId,
    ]);
    return rows[0]?.organization_id ?? null;
  }

  // --- Employee DNA (Prompt 005) --------------------------------------------

  async getDraftEmployeeDna(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDnaVersion | null> {
    const { rows } = await this.query(
      `select * from employee_dna_versions
       where organization_id = $1 and employee_id = $2 and status = 'draft' limit 1`,
      [organizationId, employeeId],
    );
    return rows[0] ? mapDnaVersion(rows[0]) : null;
  }

  async getPublishedEmployeeDna(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDnaVersion | null> {
    const { rows } = await this.query(
      `select * from employee_dna_versions
       where organization_id = $1 and employee_id = $2 and status = 'published' limit 1`,
      [organizationId, employeeId],
    );
    return rows[0] ? mapDnaVersion(rows[0]) : null;
  }

  async listEmployeeDnaVersions(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDnaVersion[]> {
    const { rows } = await this.query(
      `select * from employee_dna_versions
       where organization_id = $1 and employee_id = $2
       order by version_number desc`,
      [organizationId, employeeId],
    );
    return rows.map(mapDnaVersion);
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
    const client: PoolClient = await getPool().connect();
    try {
      await client.query("begin");
      const existing = await client.query(
        `select * from employee_dna_versions
         where organization_id = $1 and employee_id = $2 and status = 'draft'
         for update`,
        [input.organizationId, input.employeeId],
      );

      let row;
      if (existing.rows[0]) {
        const updated = await client.query(
          `update employee_dna_versions set dna = $1, updated_at = now()
           where id = $2 returning *`,
          [JSON.stringify(input.dna), existing.rows[0].id],
        );
        row = updated.rows[0];
      } else {
        const next = await client.query(
          `select coalesce(max(version_number), 0) + 1 as v
           from employee_dna_versions where organization_id = $1 and employee_id = $2`,
          [input.organizationId, input.employeeId],
        );
        const inserted = await client.query(
          `insert into employee_dna_versions
             (organization_id, employee_id, version_number, status, schema_version, dna,
              created_by_user_id)
           values ($1, $2, $3, 'draft', $4, $5, $6)
           returning *`,
          [
            input.organizationId,
            input.employeeId,
            next.rows[0].v,
            DNA_SCHEMA_VERSION,
            JSON.stringify(input.dna),
            input.userId,
          ],
        );
        row = inserted.rows[0];
      }
      await client.query("commit");
      return mapDnaVersion(row);
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }

  async publishEmployeeDna(input: PublishDnaInput): Promise<EmployeeDnaVersion> {
    const client: PoolClient = await getPool().connect();
    try {
      await client.query("begin");
      const draftResult = await client.query(
        `select * from employee_dna_versions
         where organization_id = $1 and employee_id = $2 and status = 'draft'
         for update`,
        [input.organizationId, input.employeeId],
      );
      if (!draftResult.rows[0]) {
        throw new Error("There is no draft Employee DNA to publish.");
      }

      // Archive any previously published version first (one published at a time).
      await client.query(
        `update employee_dna_versions set status = 'archived', updated_at = now()
         where organization_id = $1 and employee_id = $2 and status = 'published'`,
        [input.organizationId, input.employeeId],
      );

      const published = await client.query(
        `update employee_dna_versions
         set status = 'published', published_by_user_id = $1, published_at = now(), updated_at = now()
         where id = $2 returning *`,
        [input.userId, draftResult.rows[0].id],
      );
      await client.query("commit");
      return mapDnaVersion(published.rows[0]);
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }

  async archiveEmployeeDnaVersion(
    input: ArchiveDnaVersionInput,
  ): Promise<EmployeeDnaVersion | null> {
    const { rows } = await this.query(
      `update employee_dna_versions set status = 'archived', updated_at = now()
       where id = $1 and organization_id = $2 and employee_id = $3 returning *`,
      [input.versionId, input.organizationId, input.employeeId],
    );
    return rows[0] ? mapDnaVersion(rows[0]) : null;
  }

  // --- Knowledge Vault (Prompt 006) -----------------------------------------

  async createKnowledgeSource(input: CreateKnowledgeSourceInput): Promise<KnowledgeSource> {
    const { rows } = await this.query(
      `insert into knowledge_sources
         (organization_id, name, description, source_type, status, visibility,
          created_by_user_id, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [
        input.organizationId,
        input.name,
        input.description ?? null,
        input.sourceType,
        input.status ?? "draft",
        input.visibility ?? "organization",
        input.createdByUserId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return mapKnowledgeSource(rows[0]);
  }

  async listKnowledgeSources(organizationId: string): Promise<KnowledgeSource[]> {
    const { rows } = await this.query(
      "select * from knowledge_sources where organization_id = $1 order by updated_at desc",
      [organizationId],
    );
    return rows.map(mapKnowledgeSource);
  }

  async getKnowledgeSource(
    organizationId: string,
    sourceId: string,
  ): Promise<KnowledgeSource | null> {
    const { rows } = await this.query(
      "select * from knowledge_sources where id = $1 and organization_id = $2",
      [sourceId, organizationId],
    );
    return rows[0] ? mapKnowledgeSource(rows[0]) : null;
  }

  async updateKnowledgeSource(
    organizationId: string,
    sourceId: string,
    patch: UpdateKnowledgeSourceInput,
  ): Promise<KnowledgeSource | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const add = (column: string, value: unknown) => {
      sets.push(`${column} = $${i++}`);
      values.push(value);
    };
    if (patch.name !== undefined) add("name", patch.name);
    if ("description" in patch) add("description", patch.description ?? null);
    if (patch.visibility !== undefined) add("visibility", patch.visibility);
    if (patch.status !== undefined) add("status", patch.status);
    if (sets.length === 0) return this.getKnowledgeSource(organizationId, sourceId);
    sets.push("updated_at = now()");
    values.push(sourceId, organizationId);
    const { rows } = await this.query(
      `update knowledge_sources set ${sets.join(", ")}
       where id = $${i++} and organization_id = $${i} returning *`,
      values,
    );
    return rows[0] ? mapKnowledgeSource(rows[0]) : null;
  }

  async archiveKnowledgeSource(
    organizationId: string,
    sourceId: string,
  ): Promise<KnowledgeSource | null> {
    const { rows } = await this.query(
      `update knowledge_sources set status = 'archived', archived_at = now(), updated_at = now()
       where id = $1 and organization_id = $2 returning *`,
      [sourceId, organizationId],
    );
    return rows[0] ? mapKnowledgeSource(rows[0]) : null;
  }

  async createKnowledgeDocument(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocument> {
    const { rows } = await this.query(
      `insert into knowledge_documents
         (organization_id, knowledge_source_id, title, original_filename, content_type,
          byte_size, checksum_sha256, storage_key, text_content, text_preview,
          extraction_status, extraction_error, created_by_user_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       returning *`,
      [
        input.organizationId,
        input.knowledgeSourceId,
        input.title,
        input.originalFilename ?? null,
        input.contentType ?? null,
        input.byteSize ?? null,
        input.checksumSha256 ?? null,
        input.storageKey ?? null,
        input.textContent ?? null,
        input.textPreview ?? null,
        input.extractionStatus ?? "not_required",
        input.extractionError ?? null,
        input.createdByUserId ?? null,
      ],
    );
    return mapKnowledgeDocument(rows[0]);
  }

  async listKnowledgeDocumentsForSource(
    organizationId: string,
    sourceId: string,
  ): Promise<KnowledgeDocument[]> {
    const { rows } = await this.query(
      `select * from knowledge_documents
       where organization_id = $1 and knowledge_source_id = $2 order by created_at asc`,
      [organizationId, sourceId],
    );
    return rows.map(mapKnowledgeDocument);
  }

  async getKnowledgeDocument(
    organizationId: string,
    documentId: string,
  ): Promise<KnowledgeDocument | null> {
    const { rows } = await this.query(
      "select * from knowledge_documents where id = $1 and organization_id = $2",
      [documentId, organizationId],
    );
    return rows[0] ? mapKnowledgeDocument(rows[0]) : null;
  }

  async assignKnowledgeSourceToEmployee(
    input: AssignKnowledgeInput,
  ): Promise<EmployeeKnowledgeAssignment> {
    const { rows } = await this.query(
      `insert into employee_knowledge_sources
         (organization_id, employee_id, knowledge_source_id, assigned_by_user_id)
       values ($1, $2, $3, $4)
       on conflict (employee_id, knowledge_source_id) do update set employee_id = excluded.employee_id
       returning *`,
      [
        input.organizationId,
        input.employeeId,
        input.knowledgeSourceId,
        input.assignedByUserId ?? null,
      ],
    );
    return mapKnowledgeAssignment(rows[0]);
  }

  async unassignKnowledgeSourceFromEmployee(
    organizationId: string,
    employeeId: string,
    knowledgeSourceId: string,
  ): Promise<boolean> {
    const { rowCount } = await this.query(
      `delete from employee_knowledge_sources
       where organization_id = $1 and employee_id = $2 and knowledge_source_id = $3`,
      [organizationId, employeeId, knowledgeSourceId],
    );
    return (rowCount ?? 0) > 0;
  }

  async listKnowledgeSourcesForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<KnowledgeSource[]> {
    const { rows } = await this.query(
      `select s.* from knowledge_sources s
       join employee_knowledge_sources a on a.knowledge_source_id = s.id
       where a.organization_id = $1 and a.employee_id = $2
       order by s.updated_at desc`,
      [organizationId, employeeId],
    );
    return rows.map(mapKnowledgeSource);
  }

  async listEmployeesForKnowledgeSource(
    organizationId: string,
    knowledgeSourceId: string,
  ): Promise<AiEmployee[]> {
    const { rows } = await this.query(
      `select e.* from ai_employees e
       join employee_knowledge_sources a on a.employee_id = e.id
       where a.organization_id = $1 and a.knowledge_source_id = $2
       order by e.name asc`,
      [organizationId, knowledgeSourceId],
    );
    return rows.map(mapEmployee);
  }

  async countAssignedKnowledgeForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<number> {
    const { rows } = await this.query(
      `select count(*)::int as n from employee_knowledge_sources
       where organization_id = $1 and employee_id = $2`,
      [organizationId, employeeId],
    );
    return rows[0]?.n ?? 0;
  }

  async getKnowledgeVaultOverview(organizationId: string): Promise<KnowledgeVaultOverview> {
    const sources = (await this.listKnowledgeSources(organizationId)).filter(
      (s) => s.status !== "archived",
    );
    const { rows } = await this.query(
      "select distinct knowledge_source_id from employee_knowledge_sources where organization_id = $1",
      [organizationId],
    );
    const assignedIds = new Set(rows.map((r: Row) => r.knowledge_source_id));
    return {
      total: sources.length,
      ready: sources.filter((s) => s.status === "ready").length,
      assigned: sources.filter((s) => assignedIds.has(s.id)).length,
      recent: sources.slice(0, 5),
    };
  }

  // --- Model Hub + LLM Gateway (Prompt 006B) --------------------------------
  // The catalog is code-authoritative; these read from the code catalog so both
  // stores return identical data regardless of DB seed state.

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

  async getOrganizationModelSettings(organizationId: string): Promise<OrganizationModelSettings> {
    const { rows } = await this.query(
      "select * from organization_model_settings where organization_id = $1",
      [organizationId],
    );
    if (rows[0]) return mapOrgModelSettings(rows[0]);
    const inserted = await this.query(
      `insert into organization_model_settings (organization_id)
       values ($1)
       on conflict (organization_id) do update set organization_id = excluded.organization_id
       returning *`,
      [organizationId],
    );
    return mapOrgModelSettings(inserted.rows[0]);
  }

  async updateOrganizationModelSettings(
    organizationId: string,
    patch: UpdateOrganizationModelSettingsInput,
  ): Promise<OrganizationModelSettings> {
    const current = await this.getOrganizationModelSettings(organizationId);
    const next = {
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
    };
    const { rows } = await this.query(
      `update organization_model_settings set
         default_model_id = $2,
         routing_mode = $3,
         allowed_provider_slugs = $4,
         blocked_provider_slugs = $5,
         monthly_budget_usd = $6,
         budget_alert_threshold_percent = $7,
         fallback_model_id = $8,
         updated_by_user_id = $9,
         updated_at = now()
       where organization_id = $1
       returning *`,
      [
        organizationId,
        next.defaultModelId,
        next.routingMode,
        JSON.stringify(next.allowedProviderSlugs),
        JSON.stringify(next.blockedProviderSlugs),
        next.monthlyBudgetUsd,
        next.budgetAlertThresholdPercent,
        next.fallbackModelId,
        next.updatedByUserId,
      ],
    );
    return mapOrgModelSettings(rows[0]);
  }

  async getEmployeeModelSettings(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeModelSettings | null> {
    const { rows } = await this.query(
      "select * from employee_model_settings where organization_id = $1 and employee_id = $2",
      [organizationId, employeeId],
    );
    return rows[0] ? mapEmployeeModelSettings(rows[0]) : null;
  }

  async updateEmployeeModelSettings(
    organizationId: string,
    employeeId: string,
    patch: UpdateEmployeeModelSettingsInput,
  ): Promise<EmployeeModelSettings> {
    const current = await this.getEmployeeModelSettings(organizationId, employeeId);
    const next = {
      modelId: patch.modelId !== undefined ? patch.modelId : (current?.modelId ?? null),
      routingMode:
        patch.routingMode !== undefined ? patch.routingMode : (current?.routingMode ?? null),
      maxMonthlyBudgetUsd:
        patch.maxMonthlyBudgetUsd !== undefined
          ? patch.maxMonthlyBudgetUsd
          : (current?.maxMonthlyBudgetUsd ?? null),
      fallbackModelId:
        patch.fallbackModelId !== undefined
          ? patch.fallbackModelId
          : (current?.fallbackModelId ?? null),
      updatedByUserId: patch.updatedByUserId ?? current?.updatedByUserId ?? null,
    };
    const { rows } = await this.query(
      `insert into employee_model_settings
         (organization_id, employee_id, model_id, routing_mode, max_monthly_budget_usd,
          fallback_model_id, updated_by_user_id)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (employee_id) do update set
         model_id = excluded.model_id,
         routing_mode = excluded.routing_mode,
         max_monthly_budget_usd = excluded.max_monthly_budget_usd,
         fallback_model_id = excluded.fallback_model_id,
         updated_by_user_id = excluded.updated_by_user_id,
         updated_at = now()
       returning *`,
      [
        organizationId,
        employeeId,
        next.modelId,
        next.routingMode,
        next.maxMonthlyBudgetUsd,
        next.fallbackModelId,
        next.updatedByUserId,
      ],
    );
    return mapEmployeeModelSettings(rows[0]);
  }

  async getProviderCredentialMetadata(
    organizationId: string,
    providerSlug: ProviderSlug,
  ): Promise<ProviderCredentialMetadata | null> {
    const { rows } = await this.query(
      `select id, organization_id, provider_slug, credential_mode, key_last_four, status,
              created_by_user_id, updated_by_user_id, created_at, updated_at
       from organization_provider_credentials
       where organization_id = $1 and provider_slug = $2`,
      [organizationId, providerSlug],
    );
    return rows[0] ? mapCredentialMetadata(rows[0]) : null;
  }

  async listProviderCredentialMetadata(
    organizationId: string,
  ): Promise<ProviderCredentialMetadata[]> {
    const { rows } = await this.query(
      `select id, organization_id, provider_slug, credential_mode, key_last_four, status,
              created_by_user_id, updated_by_user_id, created_at, updated_at
       from organization_provider_credentials
       where organization_id = $1`,
      [organizationId],
    );
    return rows.map(mapCredentialMetadata);
  }

  async getProviderEncryptedKey(
    organizationId: string,
    providerSlug: ProviderSlug,
  ): Promise<string | null> {
    const { rows } = await this.query(
      `select encrypted_api_key from organization_provider_credentials
       where organization_id = $1 and provider_slug = $2`,
      [organizationId, providerSlug],
    );
    return rows[0]?.encrypted_api_key ?? null;
  }

  async saveProviderCredential(
    input: SaveProviderCredentialInput,
  ): Promise<ProviderCredentialMetadata> {
    const { rows } = await this.query(
      `insert into organization_provider_credentials
         (organization_id, provider_slug, credential_mode, encrypted_api_key, key_last_four,
          status, created_by_user_id, updated_by_user_id)
       values ($1, $2, $3, $4, $5, $6, $7, $7)
       on conflict (organization_id, provider_slug) do update set
         credential_mode = excluded.credential_mode,
         encrypted_api_key = coalesce(excluded.encrypted_api_key, organization_provider_credentials.encrypted_api_key),
         key_last_four = coalesce(excluded.key_last_four, organization_provider_credentials.key_last_four),
         status = excluded.status,
         updated_by_user_id = excluded.updated_by_user_id,
         updated_at = now()
       returning id, organization_id, provider_slug, credential_mode, key_last_four, status,
                 created_by_user_id, updated_by_user_id, created_at, updated_at`,
      [
        input.organizationId,
        input.providerSlug,
        input.credentialMode,
        input.encryptedApiKey ?? null,
        input.keyLastFour ?? null,
        input.status ?? "active",
        input.userId ?? null,
      ],
    );
    return mapCredentialMetadata(rows[0]);
  }

  async disableProviderCredential(
    organizationId: string,
    providerSlug: ProviderSlug,
    userId?: string | null,
  ): Promise<ProviderCredentialMetadata | null> {
    const { rows } = await this.query(
      `update organization_provider_credentials set
         credential_mode = 'disabled',
         status = 'disabled',
         encrypted_api_key = null,
         key_last_four = null,
         updated_by_user_id = $3,
         updated_at = now()
       where organization_id = $1 and provider_slug = $2
       returning id, organization_id, provider_slug, credential_mode, key_last_four, status,
                 created_by_user_id, updated_by_user_id, created_at, updated_at`,
      [organizationId, providerSlug, userId ?? null],
    );
    return rows[0] ? mapCredentialMetadata(rows[0]) : null;
  }

  async listLlmUsageEvents(organizationId: string, limit = 50): Promise<LlmUsageEvent[]> {
    const { rows } = await this.query(
      `select * from llm_usage_events
       where organization_id = $1
       order by created_at desc
       limit $2`,
      [organizationId, limit],
    );
    return rows.map(mapUsageEvent);
  }

  async createLlmUsageEvent(input: CreateLlmUsageEventInput): Promise<LlmUsageEvent> {
    const { rows } = await this.query(
      `insert into llm_usage_events
         (organization_id, employee_id, provider_slug, model_id, task_type, input_tokens,
          cached_input_tokens, output_tokens, estimated_cost_usd, latency_ms, status,
          error_code, request_id_hash, created_by_user_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       returning *`,
      [
        input.organizationId,
        input.employeeId ?? null,
        input.providerSlug,
        input.modelId,
        input.taskType,
        input.inputTokens,
        input.cachedInputTokens ?? 0,
        input.outputTokens,
        input.estimatedCostUsd ?? null,
        input.latencyMs ?? null,
        input.status,
        input.errorCode ?? null,
        input.requestIdHash ?? null,
        input.createdByUserId ?? null,
      ],
    );
    return mapUsageEvent(rows[0]);
  }

  async getModelHubOverview(organizationId: string): Promise<ModelHubOverview> {
    const settings = await this.getOrganizationModelSettings(organizationId);
    const [{ rows: countRows }, { rows: spendRows }, recent, configured] = await Promise.all([
      this.query("select count(*)::int as n from llm_usage_events where organization_id = $1", [
        organizationId,
      ]),
      this.query(
        "select coalesce(sum(estimated_cost_usd), 0) as total from llm_usage_events where organization_id = $1",
        [organizationId],
      ),
      this.listLlmUsageEvents(organizationId, 10),
      this.query(
        "select count(*)::int as n from organization_provider_credentials where organization_id = $1 and status = 'active'",
        [organizationId],
      ),
    ]);
    return {
      defaultModelId: settings.defaultModelId,
      routingMode: settings.routingMode,
      monthlyBudgetUsd: settings.monthlyBudgetUsd,
      allowedProviderCount:
        settings.allowedProviderSlugs.length > 0
          ? settings.allowedProviderSlugs.length
          : MODEL_PROVIDERS.length - settings.blockedProviderSlugs.length,
      totalProviders: MODEL_PROVIDERS.length,
      configuredProviderCount: configured.rows[0]?.n ?? 0,
      usageEventCount: countRows[0]?.n ?? 0,
      estimatedSpendUsd: num(spendRows[0]?.total) ?? 0,
      recentUsage: recent,
    };
  }

  // --- Employee Chat Runtime (Prompt 007) -----------------------------------

  async createEmployeeChatThread(
    input: CreateEmployeeChatThreadInput,
  ): Promise<EmployeeChatThread> {
    const { rows } = await this.query(
      `insert into employee_chat_threads
         (organization_id, employee_id, title, status, created_by_user_id)
       values ($1, $2, $3, 'active', $4)
       returning *`,
      [input.organizationId, input.employeeId, input.title ?? null, input.createdByUserId ?? null],
    );
    return mapChatThread(rows[0]);
  }

  async listEmployeeChatThreads(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeChatThread[]> {
    const { rows } = await this.query(
      `select * from employee_chat_threads
       where organization_id = $1 and employee_id = $2
       order by updated_at desc`,
      [organizationId, employeeId],
    );
    return rows.map(mapChatThread);
  }

  async getEmployeeChatThread(
    organizationId: string,
    threadId: string,
  ): Promise<EmployeeChatThread | null> {
    const { rows } = await this.query(
      "select * from employee_chat_threads where organization_id = $1 and id = $2",
      [organizationId, threadId],
    );
    return rows[0] ? mapChatThread(rows[0]) : null;
  }

  async getLatestEmployeeChatThreadForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeChatThread | null> {
    const { rows } = await this.query(
      `select * from employee_chat_threads
       where organization_id = $1 and employee_id = $2 and status = 'active'
       order by updated_at desc
       limit 1`,
      [organizationId, employeeId],
    );
    return rows[0] ? mapChatThread(rows[0]) : null;
  }

  async archiveEmployeeChatThread(
    organizationId: string,
    threadId: string,
  ): Promise<EmployeeChatThread | null> {
    const { rows } = await this.query(
      `update employee_chat_threads
       set status = 'archived', archived_at = now(), updated_at = now()
       where organization_id = $1 and id = $2
       returning *`,
      [organizationId, threadId],
    );
    return rows[0] ? mapChatThread(rows[0]) : null;
  }

  async createEmployeeChatMessage(
    input: CreateEmployeeChatMessageInput,
  ): Promise<EmployeeChatMessage> {
    const { rows } = await this.query(
      `insert into employee_chat_messages
         (organization_id, thread_id, employee_id, role, content, status, source_references,
          model_provider_slug, model_id, model_tier, routing_mode, input_tokens, output_tokens,
          estimated_cost_usd, latency_ms, error_code, brain_mode, created_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       returning *`,
      [
        input.organizationId,
        input.threadId,
        input.employeeId,
        input.role,
        input.content,
        input.status ?? "sent",
        input.sourceReferences ? JSON.stringify(input.sourceReferences) : null,
        input.modelProviderSlug ?? null,
        input.modelId ?? null,
        input.modelTier ?? null,
        input.routingMode ?? null,
        input.inputTokens ?? null,
        input.outputTokens ?? null,
        input.estimatedCostUsd ?? null,
        input.latencyMs ?? null,
        input.errorCode ?? null,
        input.brainMode ?? null,
        input.createdByUserId ?? null,
      ],
    );
    // Keep thread ordering fresh.
    await this.query(
      "update employee_chat_threads set updated_at = now() where id = $1 and organization_id = $2",
      [input.threadId, input.organizationId],
    );
    return mapChatMessage(rows[0]);
  }

  async listEmployeeChatMessages(
    organizationId: string,
    threadId: string,
  ): Promise<EmployeeChatMessage[]> {
    const { rows } = await this.query(
      `select * from employee_chat_messages
       where organization_id = $1 and thread_id = $2
       order by created_at asc`,
      [organizationId, threadId],
    );
    return rows.map(mapChatMessage);
  }

  async createKnowledgeRetrievalSegments(
    inputs: CreateKnowledgeRetrievalSegmentInput[],
  ): Promise<KnowledgeRetrievalSegment[]> {
    const created: KnowledgeRetrievalSegment[] = [];
    for (const input of inputs) {
      const { rows } = await this.query(
        `insert into knowledge_retrieval_segments
           (organization_id, knowledge_source_id, knowledge_document_id, title, content,
            content_preview, segment_index, status, metadata)
         values ($1,$2,$3,$4,$5,$6,$7,'ready',$8)
         returning *`,
        [
          input.organizationId,
          input.knowledgeSourceId,
          input.knowledgeDocumentId ?? null,
          input.title,
          input.content,
          input.contentPreview,
          input.segmentIndex,
          JSON.stringify(input.metadata ?? {}),
        ],
      );
      created.push(mapRetrievalSegment(rows[0]));
    }
    return created;
  }

  async listKnowledgeRetrievalSegmentsForSource(
    organizationId: string,
    knowledgeSourceId: string,
  ): Promise<KnowledgeRetrievalSegment[]> {
    const { rows } = await this.query(
      `select * from knowledge_retrieval_segments
       where organization_id = $1 and knowledge_source_id = $2
       order by segment_index asc`,
      [organizationId, knowledgeSourceId],
    );
    return rows.map(mapRetrievalSegment);
  }

  async listKnowledgeRetrievalSegmentsForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<KnowledgeRetrievalSegment[]> {
    // Only ready segments from assigned, non-archived sources in this org.
    const { rows } = await this.query(
      `select seg.* from knowledge_retrieval_segments seg
         join employee_knowledge_sources eks
           on eks.knowledge_source_id = seg.knowledge_source_id
          and eks.organization_id = seg.organization_id
         join knowledge_sources src
           on src.id = seg.knowledge_source_id
          and src.organization_id = seg.organization_id
       where seg.organization_id = $1
         and eks.employee_id = $2
         and seg.status = 'ready'
         and src.status <> 'archived'
       order by seg.segment_index asc`,
      [organizationId, employeeId],
    );
    return rows.map(mapRetrievalSegment);
  }

  async searchKnowledgeRetrievalSegments(
    organizationId: string,
    employeeId: string,
    query: string,
    limit = 5,
  ): Promise<RankedRetrievalSegment[]> {
    // Deterministic lexical ranking in code keeps results identical across stores.
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
    const { rowCount } = await this.query(
      "delete from knowledge_retrieval_segments where organization_id = $1 and knowledge_source_id = $2",
      [organizationId, knowledgeSourceId],
    );
    return rowCount ?? 0;
  }

  async createEmployeeChatRetrievalEvent(
    input: CreateEmployeeChatRetrievalEventInput,
  ): Promise<EmployeeChatRetrievalEvent> {
    const { rows } = await this.query(
      `insert into employee_chat_retrieval_events
         (organization_id, employee_id, thread_id, message_id, query_text_hash,
          retrieved_source_count, top_source_ids)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning *`,
      [
        input.organizationId,
        input.employeeId,
        input.threadId ?? null,
        input.messageId ?? null,
        input.queryTextHash ?? null,
        input.retrievedSourceCount,
        JSON.stringify(input.topSourceIds),
      ],
    );
    return mapChatRetrievalEvent(rows[0]);
  }

  // --- Channels (Prompt 008) ------------------------------------------------

  async createEmployeeChannel(input: CreateEmployeeChannelInput): Promise<EmployeeChannel> {
    const { rows } = await this.query(
      `insert into employee_channels
         (organization_id, employee_id, channel_type, channel_provider, public_key, secret_hash,
          name, status, allowed_domains, appearance, provider_config, welcome_message,
          rate_limit_per_minute, rate_limit_per_day, created_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       returning *`,
      [
        input.organizationId,
        input.employeeId,
        input.channelType,
        input.channelProvider ?? "taurus_web",
        input.publicKey,
        input.secretHash ?? null,
        input.name,
        input.status ?? "draft",
        JSON.stringify(input.allowedDomains ?? []),
        JSON.stringify(input.appearance),
        JSON.stringify(input.providerConfig ?? {}),
        input.welcomeMessage ?? null,
        input.rateLimitPerMinute ?? 20,
        input.rateLimitPerDay ?? 500,
        input.createdByUserId ?? null,
      ],
    );
    return mapChannel(rows[0]);
  }

  async listEmployeeChannelsForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeChannel[]> {
    const { rows } = await this.query(
      `select * from employee_channels
       where organization_id = $1 and employee_id = $2
       order by updated_at desc`,
      [organizationId, employeeId],
    );
    return rows.map(mapChannel);
  }

  async getEmployeeChannel(
    organizationId: string,
    channelId: string,
  ): Promise<EmployeeChannel | null> {
    const { rows } = await this.query(
      "select * from employee_channels where organization_id = $1 and id = $2",
      [organizationId, channelId],
    );
    return rows[0] ? mapChannel(rows[0]) : null;
  }

  async getEmployeeChannelByPublicKey(publicKey: string): Promise<EmployeeChannel | null> {
    const { rows } = await this.query("select * from employee_channels where public_key = $1", [
      publicKey,
    ]);
    return rows[0] ? mapChannel(rows[0]) : null;
  }

  async updateEmployeeChannel(
    organizationId: string,
    channelId: string,
    patch: UpdateEmployeeChannelInput,
  ): Promise<EmployeeChannel | null> {
    const current = await this.getEmployeeChannel(organizationId, channelId);
    if (!current) return null;
    const { rows } = await this.query(
      `update employee_channels set
         name = $3,
         allowed_domains = $4,
         appearance = $5,
         provider_config = $6,
         welcome_message = $7,
         rate_limit_per_minute = $8,
         rate_limit_per_day = $9,
         updated_at = now()
       where organization_id = $1 and id = $2
       returning *`,
      [
        organizationId,
        channelId,
        patch.name ?? current.name,
        JSON.stringify(patch.allowedDomains ?? current.allowedDomains),
        JSON.stringify(patch.appearance ?? current.appearance),
        JSON.stringify(patch.providerConfig ?? current.providerConfig),
        patch.welcomeMessage !== undefined ? patch.welcomeMessage : current.welcomeMessage,
        patch.rateLimitPerMinute ?? current.rateLimitPerMinute,
        patch.rateLimitPerDay ?? current.rateLimitPerDay,
      ],
    );
    return mapChannel(rows[0]);
  }

  private async setChannelStatus(
    organizationId: string,
    channelId: string,
    status: ChannelStatus,
  ): Promise<EmployeeChannel | null> {
    const { rows } = await this.query(
      `update employee_channels set
         status = $3,
         archived_at = case when $3 = 'archived' then now() else archived_at end,
         updated_at = now()
       where organization_id = $1 and id = $2
       returning *`,
      [organizationId, channelId, status],
    );
    return rows[0] ? mapChannel(rows[0]) : null;
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
    const { rows } = await this.query(
      `insert into public_chat_sessions
         (organization_id, employee_id, channel_id, thread_id, visitor_id, visitor_label,
          origin_domain, user_agent_hash, ip_hash, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')
       returning *`,
      [
        input.organizationId,
        input.employeeId,
        input.channelId,
        input.threadId ?? null,
        input.visitorId,
        input.visitorLabel ?? null,
        input.originDomain ?? null,
        input.userAgentHash ?? null,
        input.ipHash ?? null,
      ],
    );
    return mapPublicSession(rows[0]);
  }

  async getPublicChatSession(
    channelId: string,
    sessionId: string,
  ): Promise<PublicChatSession | null> {
    const { rows } = await this.query(
      "select * from public_chat_sessions where channel_id = $1 and id = $2",
      [channelId, sessionId],
    );
    return rows[0] ? mapPublicSession(rows[0]) : null;
  }

  async getOrCreatePublicChatSession(
    input: GetOrCreatePublicChatSessionInput,
  ): Promise<PublicChatSession> {
    const existing = await this.query(
      `select * from public_chat_sessions
       where channel_id = $1 and visitor_id = $2 and status = 'active'
       order by created_at desc limit 1`,
      [input.channelId, input.visitorId],
    );
    if (existing.rows[0]) return mapPublicSession(existing.rows[0]);

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
    const { rows } = await this.query(
      `insert into public_channel_events
         (organization_id, employee_id, channel_id, event_type, metadata)
       values ($1,$2,$3,$4,$5)
       returning *`,
      [
        input.organizationId,
        input.employeeId ?? null,
        input.channelId ?? null,
        input.eventType,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return mapChannelEvent(rows[0]);
  }

  async listPublicChannelEventsForEmployee(
    organizationId: string,
    employeeId: string,
    limit = 50,
  ): Promise<PublicChannelEvent[]> {
    const { rows } = await this.query(
      `select * from public_channel_events
       where organization_id = $1 and employee_id = $2
       order by created_at desc
       limit $3`,
      [organizationId, employeeId, limit],
    );
    return rows.map(mapChannelEvent);
  }

  async getChannelOverview(organizationId: string, employeeId: string): Promise<ChannelOverview> {
    const channels = await this.listEmployeeChannelsForEmployee(organizationId, employeeId);
    const nonArchived = channels.filter((c) => c.status !== "archived");
    const webChannel = nonArchived.find((c) => c.channelProvider === "taurus_web") ?? null;
    const [{ rows: sessionRows }, recentEvents] = await Promise.all([
      this.query(
        "select count(*)::int as n from public_chat_sessions where organization_id = $1 and employee_id = $2",
        [organizationId, employeeId],
      ),
      this.listPublicChannelEventsForEmployee(organizationId, employeeId, 10),
    ]);
    return {
      totalChannels: nonArchived.length,
      activeChannels: nonArchived.filter((c) => c.status === "active").length,
      webChannel,
      sessionCount: sessionRows[0]?.n ?? 0,
      recentEvents,
    };
  }

  // --- Messaging Channels (Prompt 009) --------------------------------------

  async createChannelProviderCredential(
    input: CreateChannelProviderCredentialInput,
  ): Promise<ChannelProviderCredentialMetadata> {
    const { rows } = await this.query(
      `insert into channel_provider_credentials
         (organization_id, provider_type, credential_mode, encrypted_credentials, credential_label,
          key_last_four, status, created_by_user_id, updated_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$8)
       on conflict (organization_id, provider_type) do update set
         credential_mode = excluded.credential_mode,
         encrypted_credentials = coalesce(excluded.encrypted_credentials, channel_provider_credentials.encrypted_credentials),
         credential_label = coalesce(excluded.credential_label, channel_provider_credentials.credential_label),
         key_last_four = coalesce(excluded.key_last_four, channel_provider_credentials.key_last_four),
         status = excluded.status,
         updated_by_user_id = excluded.updated_by_user_id,
         updated_at = now()
       returning id, organization_id, provider_type, credential_mode, credential_label, key_last_four,
                 status, (encrypted_credentials is not null) as has_secret, created_by_user_id,
                 updated_by_user_id, created_at, updated_at`,
      [
        input.organizationId,
        input.providerType,
        input.credentialMode,
        input.encryptedCredentials ?? null,
        input.credentialLabel ?? null,
        input.keyLastFour ?? null,
        input.status ?? "active",
        input.userId ?? null,
      ],
    );
    return mapProviderCredential(rows[0]);
  }

  async getChannelProviderCredentialMetadata(
    organizationId: string,
    providerType: ChannelProviderType,
  ): Promise<ChannelProviderCredentialMetadata | null> {
    const { rows } = await this.query(
      `select id, organization_id, provider_type, credential_mode, credential_label, key_last_four,
              status, (encrypted_credentials is not null) as has_secret, created_by_user_id,
              updated_by_user_id, created_at, updated_at
       from channel_provider_credentials
       where organization_id = $1 and provider_type = $2`,
      [organizationId, providerType],
    );
    return rows[0] ? mapProviderCredential(rows[0]) : null;
  }

  async listChannelProviderCredentials(
    organizationId: string,
  ): Promise<ChannelProviderCredentialMetadata[]> {
    const { rows } = await this.query(
      `select id, organization_id, provider_type, credential_mode, credential_label, key_last_four,
              status, (encrypted_credentials is not null) as has_secret, created_by_user_id,
              updated_by_user_id, created_at, updated_at
       from channel_provider_credentials where organization_id = $1`,
      [organizationId],
    );
    return rows.map(mapProviderCredential);
  }

  async getChannelProviderEncryptedCredentials(
    organizationId: string,
    providerType: ChannelProviderType,
  ): Promise<string | null> {
    const { rows } = await this.query(
      "select encrypted_credentials from channel_provider_credentials where organization_id = $1 and provider_type = $2",
      [organizationId, providerType],
    );
    return rows[0]?.encrypted_credentials ?? null;
  }

  async disableChannelProviderCredential(
    organizationId: string,
    providerType: ChannelProviderType,
    userId?: string | null,
  ): Promise<ChannelProviderCredentialMetadata | null> {
    const { rows } = await this.query(
      `update channel_provider_credentials set
         credential_mode = 'disabled', status = 'disabled', encrypted_credentials = null,
         key_last_four = null, updated_by_user_id = $3, updated_at = now()
       where organization_id = $1 and provider_type = $2
       returning id, organization_id, provider_type, credential_mode, credential_label, key_last_four,
                 status, (encrypted_credentials is not null) as has_secret, created_by_user_id,
                 updated_by_user_id, created_at, updated_at`,
      [organizationId, providerType, userId ?? null],
    );
    return rows[0] ? mapProviderCredential(rows[0]) : null;
  }

  async createChannelWebhookEvent(
    input: CreateChannelWebhookEventInput,
  ): Promise<ChannelWebhookEvent> {
    const { rows } = await this.query(
      `insert into channel_webhook_events
         (organization_id, channel_id, provider_type, event_type, external_event_id, status,
          metadata, processed_at, error_code)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       returning *`,
      [
        input.organizationId ?? null,
        input.channelId ?? null,
        input.providerType,
        input.eventType,
        input.externalEventId ?? null,
        input.status ?? "received",
        JSON.stringify(input.metadata ?? {}),
        input.processedAt ?? null,
        input.errorCode ?? null,
      ],
    );
    return mapWebhookEvent(rows[0]);
  }

  async updateChannelWebhookEventStatus(
    id: string,
    input: UpdateChannelWebhookEventStatusInput,
  ): Promise<ChannelWebhookEvent | null> {
    const { rows } = await this.query(
      `update channel_webhook_events set
         status = $2,
         processed_at = coalesce($3, processed_at),
         error_code = coalesce($4, error_code),
         metadata = metadata || $5::jsonb
       where id = $1
       returning *`,
      [
        id,
        input.status,
        input.processedAt ?? null,
        input.errorCode ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return rows[0] ? mapWebhookEvent(rows[0]) : null;
  }

  async listChannelWebhookEventsForChannel(
    organizationId: string,
    channelId: string,
    limit = 50,
  ): Promise<ChannelWebhookEvent[]> {
    const { rows } = await this.query(
      `select * from channel_webhook_events
       where organization_id = $1 and channel_id = $2
       order by received_at desc limit $3`,
      [organizationId, channelId, limit],
    );
    return rows.map(mapWebhookEvent);
  }

  async createMessagingTemplate(input: CreateMessagingTemplateInput): Promise<MessagingTemplate> {
    const { rows } = await this.query(
      `insert into messaging_templates
         (organization_id, channel_id, provider_type, template_name, template_category, language,
          status, external_template_id, body_preview, metadata, created_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning *`,
      [
        input.organizationId,
        input.channelId ?? null,
        input.providerType,
        input.templateName,
        input.templateCategory ?? "utility",
        input.language ?? "en",
        input.status ?? "draft",
        input.externalTemplateId ?? null,
        input.bodyPreview ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.createdByUserId ?? null,
      ],
    );
    return mapMessagingTemplate(rows[0]);
  }

  async listMessagingTemplates(
    organizationId: string,
    channelId?: string | null,
  ): Promise<MessagingTemplate[]> {
    if (channelId) {
      const { rows } = await this.query(
        "select * from messaging_templates where organization_id = $1 and channel_id = $2 order by updated_at desc",
        [organizationId, channelId],
      );
      return rows.map(mapMessagingTemplate);
    }
    const { rows } = await this.query(
      "select * from messaging_templates where organization_id = $1 order by updated_at desc",
      [organizationId],
    );
    return rows.map(mapMessagingTemplate);
  }

  async updateMessagingTemplateStatus(
    organizationId: string,
    templateId: string,
    status: MessagingTemplateStatus,
  ): Promise<MessagingTemplate | null> {
    const { rows } = await this.query(
      `update messaging_templates set status = $3, updated_at = now()
       where organization_id = $1 and id = $2 returning *`,
      [organizationId, templateId, status],
    );
    return rows[0] ? mapMessagingTemplate(rows[0]) : null;
  }

  async getMessagingContactPreference(
    organizationId: string,
    channelId: string,
    normalizedContactHash: string,
  ): Promise<MessagingContactPreference | null> {
    const { rows } = await this.query(
      `select * from messaging_contact_preferences
       where organization_id = $1 and channel_id = $2 and normalized_contact_hash = $3`,
      [organizationId, channelId, normalizedContactHash],
    );
    return rows[0] ? mapContactPreference(rows[0]) : null;
  }

  async upsertMessagingContactPreference(
    input: UpsertMessagingContactPreferenceInput,
  ): Promise<MessagingContactPreference> {
    const { rows } = await this.query(
      `insert into messaging_contact_preferences
         (organization_id, channel_id, external_contact_id, normalized_contact_hash, channel_type,
          opt_in_status, metadata)
       values ($1,$2,$3,$4,$5,$6,$7)
       on conflict (channel_id, normalized_contact_hash) do update set
         external_contact_id = coalesce(excluded.external_contact_id, messaging_contact_preferences.external_contact_id),
         opt_in_status = excluded.opt_in_status,
         metadata = excluded.metadata,
         updated_at = now()
       returning *`,
      [
        input.organizationId,
        input.channelId,
        input.externalContactId ?? null,
        input.normalizedContactHash,
        input.channelType,
        input.optInStatus ?? "unknown",
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return mapContactPreference(rows[0]);
  }

  async blockMessagingContact(
    organizationId: string,
    channelId: string,
    normalizedContactHash: string,
    _userId?: string | null,
  ): Promise<MessagingContactPreference | null> {
    void _userId;
    const { rows } = await this.query(
      `update messaging_contact_preferences set
         opt_in_status = 'blocked', blocked_at = now(), updated_at = now()
       where organization_id = $1 and channel_id = $2 and normalized_contact_hash = $3
       returning *`,
      [organizationId, channelId, normalizedContactHash],
    );
    return rows[0] ? mapContactPreference(rows[0]) : null;
  }

  async getMessagingChannelOverview(
    organizationId: string,
    employeeId: string,
  ): Promise<MessagingChannelOverview> {
    const channels = (
      await this.listEmployeeChannelsForEmployee(organizationId, employeeId)
    ).filter((c) => c.status !== "archived");
    const messagingTypes: ChannelType[] = ["whatsapp", "sms", "email"];
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
    const { rows } = await this.query(
      "select * from channel_webhook_events where organization_id = $1 order by received_at desc limit 10",
      [organizationId],
    );
    return { summaries, recentWebhookEvents: rows.map(mapWebhookEvent) };
  }

  // --- Voice Call Channel (Prompt 010) --------------------------------------

  async createVoicePhoneNumber(input: CreateVoicePhoneNumberInput): Promise<VoicePhoneNumber> {
    const { rows } = await this.query(
      `insert into voice_phone_numbers
         (organization_id, channel_id, provider_type, phone_number, display_label,
          external_phone_number_id, country_code, capabilities, status, created_by_user_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning *`,
      [
        input.organizationId,
        input.channelId,
        input.providerType,
        input.phoneNumber,
        input.displayLabel ?? null,
        input.externalPhoneNumberId ?? null,
        input.countryCode ?? null,
        JSON.stringify(input.capabilities ?? {}),
        input.status ?? "draft",
        input.createdByUserId ?? null,
      ],
    );
    return mapVoicePhoneNumber(rows[0]);
  }

  async listVoicePhoneNumbersForChannel(
    organizationId: string,
    channelId: string,
  ): Promise<VoicePhoneNumber[]> {
    const { rows } = await this.query(
      `select * from voice_phone_numbers
       where organization_id = $1 and channel_id = $2 and status <> 'archived'
       order by updated_at desc`,
      [organizationId, channelId],
    );
    return rows.map(mapVoicePhoneNumber);
  }

  async getVoicePhoneNumber(
    organizationId: string,
    phoneNumberId: string,
  ): Promise<VoicePhoneNumber | null> {
    const { rows } = await this.query(
      "select * from voice_phone_numbers where organization_id = $1 and id = $2",
      [organizationId, phoneNumberId],
    );
    return rows[0] ? mapVoicePhoneNumber(rows[0]) : null;
  }

  async updateVoicePhoneNumber(
    organizationId: string,
    phoneNumberId: string,
    patch: UpdateVoicePhoneNumberInput,
  ): Promise<VoicePhoneNumber | null> {
    const current = await this.getVoicePhoneNumber(organizationId, phoneNumberId);
    if (!current) return null;
    const { rows } = await this.query(
      `update voice_phone_numbers set
         phone_number = $3, display_label = $4, country_code = $5, capabilities = $6,
         status = $7, updated_at = now()
       where organization_id = $1 and id = $2 returning *`,
      [
        organizationId,
        phoneNumberId,
        patch.phoneNumber ?? current.phoneNumber,
        patch.displayLabel !== undefined ? patch.displayLabel : current.displayLabel,
        patch.countryCode !== undefined ? patch.countryCode : current.countryCode,
        JSON.stringify(patch.capabilities ?? current.capabilities),
        patch.status ?? current.status,
      ],
    );
    return rows[0] ? mapVoicePhoneNumber(rows[0]) : null;
  }

  async archiveVoicePhoneNumber(
    organizationId: string,
    phoneNumberId: string,
  ): Promise<VoicePhoneNumber | null> {
    const { rows } = await this.query(
      `update voice_phone_numbers set status = 'archived', archived_at = now(), updated_at = now()
       where organization_id = $1 and id = $2 returning *`,
      [organizationId, phoneNumberId],
    );
    return rows[0] ? mapVoicePhoneNumber(rows[0]) : null;
  }

  async createVoiceCallSession(input: CreateVoiceCallSessionInput): Promise<VoiceCallSession> {
    const { rows } = await this.query(
      `insert into voice_call_sessions
         (organization_id, employee_id, channel_id, phone_number_id, provider_type,
          external_call_id, direction, caller_hash, caller_label, status, recording_status,
          transcript_status, metadata)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       returning *`,
      [
        input.organizationId,
        input.employeeId,
        input.channelId,
        input.phoneNumberId ?? null,
        input.providerType,
        input.externalCallId ?? null,
        input.direction ?? "inbound",
        input.callerHash ?? null,
        input.callerLabel ?? null,
        input.status ?? "ringing",
        input.recordingStatus ?? "disabled",
        input.transcriptStatus ?? "pending",
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return mapVoiceCall(rows[0]);
  }

  async getVoiceCallSession(
    organizationId: string,
    callSessionId: string,
  ): Promise<VoiceCallSession | null> {
    const { rows } = await this.query(
      "select * from voice_call_sessions where organization_id = $1 and id = $2",
      [organizationId, callSessionId],
    );
    return rows[0] ? mapVoiceCall(rows[0]) : null;
  }

  async getVoiceCallSessionByExternalId(
    providerType: ChannelProviderType,
    externalCallId: string,
  ): Promise<VoiceCallSession | null> {
    const { rows } = await this.query(
      "select * from voice_call_sessions where provider_type = $1 and external_call_id = $2 order by created_at desc limit 1",
      [providerType, externalCallId],
    );
    return rows[0] ? mapVoiceCall(rows[0]) : null;
  }

  async updateVoiceCallSessionStatus(
    organizationId: string,
    callSessionId: string,
    patch: UpdateVoiceCallSessionStatusInput,
  ): Promise<VoiceCallSession | null> {
    const current = await this.getVoiceCallSession(organizationId, callSessionId);
    if (!current) return null;
    const { rows } = await this.query(
      `update voice_call_sessions set
         status = $3, answered_at = $4, ended_at = $5, duration_seconds = $6, end_reason = $7,
         recording_status = $8, transcript_status = $9, external_call_id = $10,
         metadata = metadata || $11::jsonb, updated_at = now()
       where organization_id = $1 and id = $2 returning *`,
      [
        organizationId,
        callSessionId,
        patch.status ?? current.status,
        patch.answeredAt !== undefined ? patch.answeredAt : current.answeredAt,
        patch.endedAt !== undefined ? patch.endedAt : current.endedAt,
        patch.durationSeconds !== undefined ? patch.durationSeconds : current.durationSeconds,
        patch.endReason !== undefined ? patch.endReason : current.endReason,
        patch.recordingStatus ?? current.recordingStatus,
        patch.transcriptStatus ?? current.transcriptStatus,
        patch.externalCallId !== undefined ? patch.externalCallId : current.externalCallId,
        JSON.stringify(patch.metadata ?? {}),
      ],
    );
    return rows[0] ? mapVoiceCall(rows[0]) : null;
  }

  async endVoiceCallSession(
    organizationId: string,
    callSessionId: string,
    endReason: string,
  ): Promise<VoiceCallSession | null> {
    const { rows } = await this.query(
      `update voice_call_sessions set
         status = case when status = 'failed' then 'failed' else 'completed' end,
         ended_at = now(),
         duration_seconds = greatest(0, extract(epoch from (now() - started_at))::int),
         end_reason = $3,
         transcript_status = case when transcript_status = 'pending' then 'completed' else transcript_status end,
         updated_at = now()
       where organization_id = $1 and id = $2 returning *`,
      [organizationId, callSessionId, endReason],
    );
    return rows[0] ? mapVoiceCall(rows[0]) : null;
  }

  async createVoiceTranscriptMessage(
    input: CreateVoiceTranscriptMessageInput,
  ): Promise<VoiceTranscriptMessage> {
    const { rows } = await this.query(
      `insert into voice_call_transcript_messages
         (organization_id, employee_id, channel_id, call_session_id, speaker_type, content,
          confidence, started_at_ms, ended_at_ms, source_references, model_provider_slug,
          model_id, estimated_cost_usd, metadata)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       returning *`,
      [
        input.organizationId,
        input.employeeId,
        input.channelId,
        input.callSessionId,
        input.speakerType,
        input.content,
        input.confidence ?? null,
        input.startedAtMs ?? null,
        input.endedAtMs ?? null,
        input.sourceReferences ? JSON.stringify(input.sourceReferences) : null,
        input.modelProviderSlug ?? null,
        input.modelId ?? null,
        input.estimatedCostUsd ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return mapVoiceTranscript(rows[0]);
  }

  async listVoiceTranscriptMessages(
    organizationId: string,
    callSessionId: string,
  ): Promise<VoiceTranscriptMessage[]> {
    const { rows } = await this.query(
      `select * from voice_call_transcript_messages
       where organization_id = $1 and call_session_id = $2 order by created_at asc`,
      [organizationId, callSessionId],
    );
    return rows.map(mapVoiceTranscript);
  }

  async createVoiceStreamEvent(input: CreateVoiceStreamEventInput): Promise<VoiceStreamEvent> {
    const { rows } = await this.query(
      `insert into voice_stream_events
         (organization_id, employee_id, channel_id, call_session_id, provider_type, event_type,
          status, metadata)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       returning *`,
      [
        input.organizationId ?? null,
        input.employeeId ?? null,
        input.channelId ?? null,
        input.callSessionId ?? null,
        input.providerType,
        input.eventType,
        input.status ?? "ok",
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return mapVoiceStreamEvent(rows[0]);
  }

  async listVoiceStreamEventsForCall(
    organizationId: string,
    callSessionId: string,
    limit = 50,
  ): Promise<VoiceStreamEvent[]> {
    const { rows } = await this.query(
      `select * from voice_stream_events
       where organization_id = $1 and call_session_id = $2 order by created_at desc limit $3`,
      [organizationId, callSessionId, limit],
    );
    return rows.map(mapVoiceStreamEvent);
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
      const { rows } = await this.query(
        "select * from voice_call_sessions where organization_id = $1 and channel_id = $2 order by started_at desc limit 10",
        [organizationId, channel.id],
      );
      recentCalls = rows.map(mapVoiceCall);
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

  async createAuditEvent(input: AuditEventInput): Promise<AuditEvent> {
    const { rows } = await this.query(
      `insert into audit_events
         (organization_id, actor_type, actor_id, action, target_type, target_id, metadata)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, created_at`,
      [
        input.organizationId,
        input.actorType,
        input.actorId,
        input.action,
        input.targetType ?? null,
        input.targetId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return {
      ...input,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? {},
      id: rows[0].id,
      createdAt: new Date(rows[0].created_at).toISOString(),
    };
  }
}
