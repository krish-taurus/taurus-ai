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

// --- Knowledge Vault (Prompt 006) ------------------------------------------

export type KnowledgeSourceType = "file" | "text" | "url";

export type KnowledgeSourceStatus =
  | "draft"
  | "uploaded"
  | "processing"
  | "ready"
  | "failed"
  | "archived";

export type KnowledgeVisibility = "private" | "organization";

export type DocumentExtractionStatus =
  | "not_required"
  | "pending"
  | "extracted"
  | "failed"
  | "unsupported";

/**
 * A knowledge source in an organization's Knowledge Vault: a document, note, or
 * website record. Every source is tenant-scoped via `organizationId`.
 */
export interface KnowledgeSource {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  sourceType: KnowledgeSourceType;
  status: KnowledgeSourceStatus;
  visibility: KnowledgeVisibility;
  createdByUserId: string | null;
  archivedAt: string | null;
  /** Non-sensitive structured metadata (e.g. url for url sources). */
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** A stored document belonging to a knowledge source. */
export interface KnowledgeDocument {
  id: string;
  organizationId: string;
  knowledgeSourceId: string;
  title: string;
  originalFilename: string | null;
  contentType: string | null;
  byteSize: number | null;
  checksumSha256: string | null;
  /** Opaque storage key — never a public path, never rendered to the browser. */
  storageKey: string | null;
  /** Extracted text for simple text formats; null for pdf/docx (metadata only). */
  textContent: string | null;
  textPreview: string | null;
  extractionStatus: DocumentExtractionStatus;
  extractionError: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Assignment of a knowledge source to an AI Employee. */
export interface EmployeeKnowledgeAssignment {
  id: string;
  organizationId: string;
  employeeId: string;
  knowledgeSourceId: string;
  assignedByUserId: string | null;
  createdAt: string;
}

export interface CreateKnowledgeSourceInput {
  organizationId: string;
  name: string;
  description?: string | null;
  sourceType: KnowledgeSourceType;
  status?: KnowledgeSourceStatus;
  visibility?: KnowledgeVisibility;
  metadata?: Record<string, unknown>;
  createdByUserId?: string | null;
}

export interface UpdateKnowledgeSourceInput {
  name?: string;
  description?: string | null;
  visibility?: KnowledgeVisibility;
  status?: KnowledgeSourceStatus;
}

export interface CreateKnowledgeDocumentInput {
  organizationId: string;
  knowledgeSourceId: string;
  title: string;
  originalFilename?: string | null;
  contentType?: string | null;
  byteSize?: number | null;
  checksumSha256?: string | null;
  storageKey?: string | null;
  textContent?: string | null;
  textPreview?: string | null;
  extractionStatus?: DocumentExtractionStatus;
  extractionError?: string | null;
  createdByUserId?: string | null;
}

export interface AssignKnowledgeInput {
  organizationId: string;
  employeeId: string;
  knowledgeSourceId: string;
  assignedByUserId?: string | null;
}

/** Aggregate counts for the Knowledge Vault dashboard cards. */
export interface KnowledgeVaultOverview {
  total: number;
  ready: number;
  assigned: number;
  recent: KnowledgeSource[];
}

// ===========================================================================
// Model Hub + LLM Gateway (Prompt 006B)
//
// Provider-agnostic model configuration. String-literal unions live here (no
// runtime deps) so both the code catalog (model-gateway) and the stores can
// share them without an import cycle.
// ===========================================================================

export type ProviderSlug =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "moonshot_kimi"
  | "groq"
  | "google_gemini"
  | "fireworks"
  | "custom_openai_compatible";

export type ProviderType = "openai" | "anthropic" | "google" | "openai_compatible";

export type ModelTier =
  | "economy"
  | "balanced"
  | "premium"
  | "realtime"
  | "private_open"
  | "coding"
  | "reasoning";

export type RoutingMode =
  | "auto_balanced"
  | "cost_optimized"
  | "quality_first"
  | "privacy_first"
  | "provider_locked"
  | "manual";

export type CredentialMode = "taurus_managed" | "bring_your_own_key" | "disabled";

export type CredentialStatus = "active" | "disabled" | "error";

export type LlmTaskType =
  | "employee_chat"
  | "rag_answer"
  | "dna_summary"
  | "knowledge_summary"
  | "classification"
  | "tool_planning"
  | "internal_collaboration"
  | "voice_realtime"
  | "system_test";

export type LlmUsageStatus = "success" | "error" | "blocked";

/** Organization-level default model configuration (one row per organization). */
export interface OrganizationModelSettings {
  id: string;
  organizationId: string;
  defaultModelId: string | null;
  routingMode: RoutingMode;
  allowedProviderSlugs: ProviderSlug[];
  blockedProviderSlugs: ProviderSlug[];
  monthlyBudgetUsd: number | null;
  budgetAlertThresholdPercent: number | null;
  fallbackModelId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrganizationModelSettingsInput {
  defaultModelId?: string | null;
  routingMode?: RoutingMode;
  allowedProviderSlugs?: ProviderSlug[];
  blockedProviderSlugs?: ProviderSlug[];
  monthlyBudgetUsd?: number | null;
  budgetAlertThresholdPercent?: number | null;
  fallbackModelId?: string | null;
  updatedByUserId?: string | null;
}

/** Employee-level model override (one row per employee). */
export interface EmployeeModelSettings {
  id: string;
  organizationId: string;
  employeeId: string;
  modelId: string | null;
  routingMode: RoutingMode | null;
  maxMonthlyBudgetUsd: number | null;
  fallbackModelId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateEmployeeModelSettingsInput {
  modelId?: string | null;
  routingMode?: RoutingMode | null;
  maxMonthlyBudgetUsd?: number | null;
  fallbackModelId?: string | null;
  updatedByUserId?: string | null;
}

/**
 * Provider credential metadata safe to return to the UI. The encrypted key and
 * plaintext are NEVER part of this shape — only the mode, status, and last four.
 */
export interface ProviderCredentialMetadata {
  id: string;
  organizationId: string;
  providerSlug: ProviderSlug;
  credentialMode: CredentialMode;
  keyLastFour: string | null;
  status: CredentialStatus;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveProviderCredentialInput {
  organizationId: string;
  providerSlug: ProviderSlug;
  credentialMode: CredentialMode;
  /** Already-encrypted value (never plaintext). Null when disabling/managed. */
  encryptedApiKey?: string | null;
  keyLastFour?: string | null;
  status?: CredentialStatus;
  userId?: string | null;
}

/** A usage event. NEVER stores message contents — token counts + metadata only. */
export interface LlmUsageEvent {
  id: string;
  organizationId: string;
  employeeId: string | null;
  providerSlug: ProviderSlug;
  modelId: string;
  taskType: LlmTaskType;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
  latencyMs: number | null;
  status: LlmUsageStatus;
  errorCode: string | null;
  requestIdHash: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface CreateLlmUsageEventInput {
  organizationId: string;
  employeeId?: string | null;
  providerSlug: ProviderSlug;
  modelId: string;
  taskType: LlmTaskType;
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
  estimatedCostUsd?: number | null;
  latencyMs?: number | null;
  status: LlmUsageStatus;
  errorCode?: string | null;
  requestIdHash?: string | null;
  createdByUserId?: string | null;
}

/** Aggregate data for the Model Hub overview cards. */
export interface ModelHubOverview {
  defaultModelId: string | null;
  routingMode: RoutingMode;
  monthlyBudgetUsd: number | null;
  allowedProviderCount: number;
  totalProviders: number;
  configuredProviderCount: number;
  usageEventCount: number;
  estimatedSpendUsd: number;
  recentUsage: LlmUsageEvent[];
}

// ===========================================================================
// Employee Chat Runtime (Prompt 007)
//
// Chat message contents live only in EmployeeChatMessage. Retrieval segments are
// internal excerpts (never called "chunks" in the UI). Retrieval events store a
// query hash, never the full question.
// ===========================================================================

export type ChatThreadStatus = "active" | "archived";
export type ChatMessageRole = "user" | "assistant" | "system";
export type ChatMessageStatus = "sent" | "pending" | "failed";
export type BrainMode = "live" | "local_demo";
export type RetrievalSegmentStatus = "ready" | "archived";

/** A source reference attached to an assistant message (safe, UI-facing shape). */
export interface ChatSourceReference {
  sourceId: string;
  name: string;
  sourceType: KnowledgeSourceType;
  documentId: string | null;
  preview: string;
}

export interface EmployeeChatThread {
  id: string;
  organizationId: string;
  employeeId: string;
  title: string | null;
  status: ChatThreadStatus;
  createdByUserId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeChatThreadInput {
  organizationId: string;
  employeeId: string;
  title?: string | null;
  createdByUserId?: string | null;
}

export interface EmployeeChatMessage {
  id: string;
  organizationId: string;
  threadId: string;
  employeeId: string;
  role: ChatMessageRole;
  content: string;
  status: ChatMessageStatus;
  sourceReferences: ChatSourceReference[] | null;
  modelProviderSlug: string | null;
  modelId: string | null;
  modelTier: string | null;
  routingMode: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  latencyMs: number | null;
  errorCode: string | null;
  brainMode: BrainMode | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface CreateEmployeeChatMessageInput {
  organizationId: string;
  threadId: string;
  employeeId: string;
  role: ChatMessageRole;
  content: string;
  status?: ChatMessageStatus;
  sourceReferences?: ChatSourceReference[] | null;
  modelProviderSlug?: string | null;
  modelId?: string | null;
  modelTier?: string | null;
  routingMode?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
  latencyMs?: number | null;
  errorCode?: string | null;
  brainMode?: BrainMode | null;
  createdByUserId?: string | null;
}

/** Internal searchable excerpt of prepared knowledge. */
export interface KnowledgeRetrievalSegment {
  id: string;
  organizationId: string;
  knowledgeSourceId: string;
  knowledgeDocumentId: string | null;
  title: string;
  content: string;
  contentPreview: string;
  segmentIndex: number;
  status: RetrievalSegmentStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeRetrievalSegmentInput {
  organizationId: string;
  knowledgeSourceId: string;
  knowledgeDocumentId?: string | null;
  title: string;
  content: string;
  contentPreview: string;
  segmentIndex: number;
  metadata?: Record<string, unknown>;
}

export interface CreateEmployeeChatRetrievalEventInput {
  organizationId: string;
  employeeId: string;
  threadId?: string | null;
  messageId?: string | null;
  queryTextHash?: string | null;
  retrievedSourceCount: number;
  topSourceIds: string[];
}

export interface EmployeeChatRetrievalEvent {
  id: string;
  organizationId: string;
  employeeId: string;
  threadId: string | null;
  messageId: string | null;
  queryTextHash: string | null;
  retrievedSourceCount: number;
  topSourceIds: string[];
  createdAt: string;
}

/** A retrieval segment plus its lexical relevance score (internal, not UI). */
export interface RankedRetrievalSegment {
  segment: KnowledgeRetrievalSegment;
  score: number;
  matchedTerms: string[];
}
