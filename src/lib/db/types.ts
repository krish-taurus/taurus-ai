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
  /** Linked Supabase Auth user id (auth.users.id), or null for dev-auth users. */
  supabaseAuthUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * How an organization's AI Employee interactions are served (Sprint 016):
 *   - "managed" : run on Taurus's provider keys; Taurus bears the token cost and
 *                 earns the subscription + token spread. Zero-setup default.
 *   - "byok"    : run on the customer's own encrypted key; cost to Taurus is 0
 *                 and margin is subscription-only (~100%).
 * Frontier-tier models are only selectable in "byok" mode (margin guardrail).
 */
export const MODEL_ACCESS_MODES = ["managed", "byok"] as const;
export type ModelAccessMode = (typeof MODEL_ACCESS_MODES)[number];

export function isModelAccessMode(value: unknown): value is ModelAccessMode {
  return typeof value === "string" && (MODEL_ACCESS_MODES as readonly string[]).includes(value);
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  websiteUrl: string | null;
  sizeRange: string | null;
  /** How interactions are served + billed (Sprint 016). Defaults to "managed". */
  modelAccessMode: ModelAccessMode;
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
  avatarUrl?: string | null;
  supabaseAuthUserId?: string | null;
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

export type KnowledgeSourceType =
  | "file"
  | "text"
  | "url"
  | "database"
  | "google_drive"
  | "cloud_storage"
  | "sharepoint";

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
  /** The vault (collection) this source belongs to (Sprint 028). */
  vaultId: string | null;
  name: string;
  description: string | null;
  sourceType: KnowledgeSourceType;
  status: KnowledgeSourceStatus;
  visibility: KnowledgeVisibility;
  createdByUserId: string | null;
  archivedAt: string | null;
  /** Chunk + embed state for semantic search (Sprint 019). */
  indexingState: KnowledgeIndexingState;
  /** Non-sensitive structured metadata (e.g. url for url sources). */
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** A vault: a named collection of knowledge sources within an org (Sprint 028). */
export interface KnowledgeVault {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  /** The auto "General" vault existing sources migrate into; cannot be deleted. */
  isDefault: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeVaultInput {
  organizationId: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  createdByUserId?: string | null;
}

export interface UpdateKnowledgeVaultInput {
  name?: string;
  description?: string | null;
}

/** A vault plus its source counts, for the Knowledge list grouping. */
export interface KnowledgeVaultSummary {
  vault: KnowledgeVault;
  sourceCount: number;
  readyCount: number;
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

/** Assignment of a whole vault to an AI Employee (Sprint 029). */
export interface EmployeeVaultAssignment {
  id: string;
  organizationId: string;
  employeeId: string;
  vaultId: string;
  assignedByUserId: string | null;
  createdAt: string;
}

export interface AssignVaultInput {
  organizationId: string;
  employeeId: string;
  vaultId: string;
  assignedByUserId?: string | null;
}

// ===========================================================================
// Inter-company AI Employee marketplace (Sprint 030)
//
// A listing publishes an employee as a public "resume". The listing is a
// self-contained SNAPSHOT (dna/performance/vaults captured at publish time) so
// the public marketplace never reads the seller's live private tables.
// ===========================================================================

export type MarketplaceListingStatus = "draft" | "published" | "unpublished";
export type MarketplaceHireStatus = "requested" | "approved" | "declined";

/** A performance summary captured on the resume (all derived from review runs). */
export interface PerformanceSnapshot {
  reviewCount: number;
  bestScore: number | null; // best overall weighted score (0-1)
  latestScore: number | null;
  passRate: number | null; // 0-1 across all completed runs
  trend: Array<{ dnaVersionNumber: number; overallScore: number | null; completedAt: string }>;
}

/** A vault the agent uses, as shown on the resume (description only — no content). */
export interface VaultSnapshotItem {
  name: string;
  description: string | null;
}

export interface MarketplaceListing {
  id: string;
  organizationId: string;
  employeeId: string;
  publicKey: string;
  title: string;
  headline: string | null;
  summary: string | null;
  roleTitle: string | null;
  status: MarketplaceListingStatus;
  includeVaults: boolean;
  dnaVersionNumber: number | null;
  /** Full DNA to display + clone (org-specific companyContext blanked). */
  dnaSnapshot: EmployeeDnaV1;
  performanceSnapshot: PerformanceSnapshot;
  vaultSnapshot: VaultSnapshotItem[];
  hireCount: number;
  createdByUserId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMarketplaceListingInput {
  organizationId: string;
  employeeId: string;
  publicKey: string;
  title: string;
  headline?: string | null;
  summary?: string | null;
  roleTitle?: string | null;
  status?: MarketplaceListingStatus;
  includeVaults?: boolean;
  dnaVersionNumber?: number | null;
  dnaSnapshot: EmployeeDnaV1;
  performanceSnapshot: PerformanceSnapshot;
  vaultSnapshot?: VaultSnapshotItem[];
  createdByUserId?: string | null;
  publishedAt?: string | null;
}

export interface UpdateMarketplaceListingInput {
  title?: string;
  headline?: string | null;
  summary?: string | null;
  roleTitle?: string | null;
  status?: MarketplaceListingStatus;
  includeVaults?: boolean;
  dnaVersionNumber?: number | null;
  dnaSnapshot?: EmployeeDnaV1;
  performanceSnapshot?: PerformanceSnapshot;
  vaultSnapshot?: VaultSnapshotItem[];
  publishedAt?: string | null;
}

export interface MarketplaceHire {
  id: string;
  listingId: string;
  listingOrganizationId: string;
  hirerOrganizationId: string;
  hirerEmployeeId: string | null;
  status: MarketplaceHireStatus;
  note: string | null;
  requestedByUserId: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface CreateMarketplaceHireInput {
  listingId: string;
  listingOrganizationId: string;
  hirerOrganizationId: string;
  note?: string | null;
  requestedByUserId?: string | null;
}

export interface UpdateMarketplaceHireInput {
  status?: MarketplaceHireStatus;
  hirerEmployeeId?: string | null;
  decidedByUserId?: string | null;
  decidedAt?: string | null;
}

export interface CreateKnowledgeSourceInput {
  organizationId: string;
  vaultId?: string | null;
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
  /** Move the source to a different vault (Sprint 028). */
  vaultId?: string;
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
  | "performance_review"
  | "embedding"
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
  /** Custom endpoint base URL (OpenAI-compatible providers). Not a secret. */
  baseUrl: string | null;
  /** Optional human label for the saved key. Not a secret. */
  label: string | null;
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
  /** Custom endpoint base URL (OpenAI-compatible providers). Not a secret. */
  baseUrl?: string | null;
  /** Optional human label for the saved key. Not a secret. */
  label?: string | null;
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
  /**
   * Serving cost to Taurus for this interaction, computed at write time from the
   * price snapshot below (Sprint 016). 0 when `byok` (customer bears the cost).
   */
  costUsd: number | null;
  /** $ / 1M input tokens used at write time (price snapshot; stays historically accurate). */
  unitInputPrice: number | null;
  /** $ / 1M output tokens used at write time (price snapshot). */
  unitOutputPrice: number | null;
  /** True when the interaction ran on the customer's own key (cost 0 to Taurus). */
  byok: boolean;
  /** Deployment channel the interaction came through, for usage breakdowns. */
  channelType: ChannelType | null;
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
  costUsd?: number | null;
  unitInputPrice?: number | null;
  unitOutputPrice?: number | null;
  byok?: boolean;
  channelType?: ChannelType | null;
  latencyMs?: number | null;
  status: LlmUsageStatus;
  errorCode?: string | null;
  requestIdHash?: string | null;
  createdByUserId?: string | null;
}

/**
 * Cross-tenant per-organization usage-cost aggregate for the operator margin
 * view (Sprint 016). NOT tenant-scoped — only ever queried behind the
 * platform-operator gate, never from a customer route.
 */
export interface UsageCostAggregateRow {
  organizationId: string;
  /** Billable interactions in the period. */
  interactionCount: number;
  managedInteractionCount: number;
  byokInteractionCount: number;
  /** Sum of cost_usd in the period (BYOK contributes 0). */
  totalCostUsd: number;
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
  /** Embedding vector for semantic retrieval (Sprint 019). Null until embedded. */
  embedding: number[] | null;
  /** The embedding model + dimension, so a model change can trigger a re-embed. */
  embeddingModelId: string | null;
  embeddingDim: number | null;
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
  embedding?: number[] | null;
  embeddingModelId?: string | null;
  embeddingDim?: number | null;
  metadata?: Record<string, unknown>;
}

/** Whether a Knowledge source has been chunked + embedded for search (Sprint 019). */
export const KNOWLEDGE_INDEXING_STATES = ["pending", "indexing", "ready", "failed"] as const;
export type KnowledgeIndexingState = (typeof KNOWLEDGE_INDEXING_STATES)[number];

/** A semantic search hit — a segment with its cosine similarity (0–1). */
export interface SemanticRetrievalSegment {
  segment: KnowledgeRetrievalSegment;
  similarity: number;
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

// ===========================================================================
// Channels + Website Widget (Prompt 008)
//
// External deployment surfaces for an AI Employee. Web channels are runnable;
// messaging/voice/workplace channel types are reserved foundation. Public flows
// resolve the organization from the channel public key — never from the client.
// ===========================================================================

export type ChannelType =
  | "hosted_chat"
  | "website_widget"
  | "iframe_embed"
  | "public_api"
  | "whatsapp"
  | "sms"
  | "email"
  | "phone_call"
  | "slack"
  | "microsoft_teams"
  | "instagram_dm"
  | "facebook_messenger"
  | "telegram";

export type ChannelCategory = "web" | "messaging" | "voice" | "workplace";

export type ChannelProviderType =
  | "taurus_web"
  | "twilio"
  | "meta_whatsapp_cloud"
  | "telnyx"
  | "vonage"
  | "sendgrid"
  | "mailgun"
  | "slack"
  | "microsoft_graph"
  | "telegram"
  | "custom_webhook"
  // Voice Call Channel (Prompt 010).
  | "twilio_voice"
  | "telnyx_voice"
  | "vonage_voice"
  | "simulated_voice";

export type ChannelStatus = "draft" | "active" | "paused" | "archived";
export type PublicChatSessionStatus = "active" | "archived" | "blocked";

export type PublicChannelEventType =
  | "channel.created"
  | "channel.updated"
  | "channel.activated"
  | "channel.paused"
  | "channel.archived"
  | "public_chat.session_started"
  | "public_chat.message_sent"
  | "public_chat.response_generated"
  | "public_chat.response_failed"
  | "widget.loaded";

/** Non-technical appearance settings for a web channel. */
export interface ChannelAppearance {
  theme: "dark" | "light";
  position: "bottom-right" | "bottom-left";
  launcherLabel: string;
  employeeDisplayName: string;
  accentStyle: "mono" | "solid";
  showSources: boolean;
  /** Placeholder only this sprint — not wired to any collection flow. */
  collectVisitorEmail: boolean;
  brandName: string | null;
}

export interface EmployeeChannel {
  id: string;
  organizationId: string;
  employeeId: string;
  channelType: ChannelType;
  channelProvider: ChannelProviderType;
  publicKey: string;
  /** Present only as a hash; never the raw secret. */
  hasSecret: boolean;
  name: string;
  status: ChannelStatus;
  allowedDomains: string[];
  appearance: ChannelAppearance;
  /** Non-secret provider configuration (foundation for future channels). */
  providerConfig: Record<string, unknown>;
  welcomeMessage: string | null;
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  createdByUserId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeChannelInput {
  organizationId: string;
  employeeId: string;
  channelType: ChannelType;
  channelProvider?: ChannelProviderType;
  publicKey: string;
  secretHash?: string | null;
  name: string;
  status?: ChannelStatus;
  allowedDomains?: string[];
  appearance: ChannelAppearance;
  providerConfig?: Record<string, unknown>;
  welcomeMessage?: string | null;
  rateLimitPerMinute?: number;
  rateLimitPerDay?: number;
  createdByUserId?: string | null;
}

export interface UpdateEmployeeChannelInput {
  name?: string;
  allowedDomains?: string[];
  appearance?: ChannelAppearance;
  providerConfig?: Record<string, unknown>;
  welcomeMessage?: string | null;
  rateLimitPerMinute?: number;
  rateLimitPerDay?: number;
}

export interface PublicChatSession {
  id: string;
  organizationId: string;
  employeeId: string;
  channelId: string;
  threadId: string | null;
  visitorId: string;
  visitorLabel: string | null;
  originDomain: string | null;
  userAgentHash: string | null;
  ipHash: string | null;
  status: PublicChatSessionStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface CreatePublicChatSessionInput {
  organizationId: string;
  employeeId: string;
  channelId: string;
  threadId?: string | null;
  visitorId: string;
  visitorLabel?: string | null;
  originDomain?: string | null;
  userAgentHash?: string | null;
  ipHash?: string | null;
}

export interface PublicChannelEvent {
  id: string;
  organizationId: string;
  employeeId: string | null;
  channelId: string | null;
  eventType: PublicChannelEventType;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreatePublicChannelEventInput {
  organizationId: string;
  employeeId?: string | null;
  channelId?: string | null;
  eventType: PublicChannelEventType;
  metadata?: Record<string, unknown>;
}

/** Aggregate data for the Channels dashboard cards. */
export interface ChannelOverview {
  totalChannels: number;
  activeChannels: number;
  webChannel: EmployeeChannel | null;
  sessionCount: number;
  recentEvents: PublicChannelEvent[];
}

export interface GetOrCreatePublicChatSessionInput {
  organizationId: string;
  employeeId: string;
  channelId: string;
  visitorId: string;
  visitorLabel?: string | null;
  originDomain?: string | null;
  userAgentHash?: string | null;
  ipHash?: string | null;
}

// ===========================================================================
// Messaging Channels (Prompt 009)
//
// Foundation for WhatsApp / SMS / Email on top of the Prompt 008 channel model.
// Credentials are stored encrypted only; webhook events + audit are metadata
// only; contacts are keyed by a salted hash.
// ===========================================================================

export type ChannelCredentialMode = "bring_your_own_key" | "taurus_managed" | "disabled";
export type ChannelCredentialStatus = "active" | "disabled" | "error";

export type ChannelWebhookEventType =
  | "inbound"
  | "delivery_status"
  | "verification"
  | "ignored"
  | "error";
export type ChannelWebhookEventStatus = "received" | "processed" | "failed" | "ignored";

export type MessagingTemplateStatus = "draft" | "active" | "disabled";

export type MessageOptInStatus = "unknown" | "opted_in" | "opted_out" | "blocked";

/** Client-safe credential metadata — the encrypted value is NEVER included. */
export interface ChannelProviderCredentialMetadata {
  id: string;
  organizationId: string;
  providerType: ChannelProviderType;
  credentialMode: ChannelCredentialMode;
  credentialLabel: string | null;
  keyLastFour: string | null;
  hasSecret: boolean;
  status: ChannelCredentialStatus;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelProviderCredentialInput {
  organizationId: string;
  providerType: ChannelProviderType;
  credentialMode: ChannelCredentialMode;
  /** Already-encrypted blob (never plaintext). Null when disabling. */
  encryptedCredentials?: string | null;
  credentialLabel?: string | null;
  keyLastFour?: string | null;
  status?: ChannelCredentialStatus;
  userId?: string | null;
}

export interface ChannelWebhookEvent {
  id: string;
  organizationId: string | null;
  channelId: string | null;
  providerType: ChannelProviderType;
  eventType: ChannelWebhookEventType;
  externalEventId: string | null;
  status: ChannelWebhookEventStatus;
  metadata: Record<string, unknown>;
  receivedAt: string;
  processedAt: string | null;
  errorCode: string | null;
  createdAt: string;
}

export interface CreateChannelWebhookEventInput {
  organizationId?: string | null;
  channelId?: string | null;
  providerType: ChannelProviderType;
  eventType: ChannelWebhookEventType;
  externalEventId?: string | null;
  status?: ChannelWebhookEventStatus;
  metadata?: Record<string, unknown>;
  processedAt?: string | null;
  errorCode?: string | null;
}

export interface UpdateChannelWebhookEventStatusInput {
  status: ChannelWebhookEventStatus;
  processedAt?: string | null;
  errorCode?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MessagingTemplate {
  id: string;
  organizationId: string;
  channelId: string | null;
  providerType: ChannelProviderType;
  templateName: string;
  templateCategory: string;
  language: string;
  status: MessagingTemplateStatus;
  externalTemplateId: string | null;
  bodyPreview: string | null;
  metadata: Record<string, unknown>;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMessagingTemplateInput {
  organizationId: string;
  channelId?: string | null;
  providerType: ChannelProviderType;
  templateName: string;
  templateCategory?: string;
  language?: string;
  status?: MessagingTemplateStatus;
  externalTemplateId?: string | null;
  bodyPreview?: string | null;
  metadata?: Record<string, unknown>;
  createdByUserId?: string | null;
}

export interface MessagingContactPreference {
  id: string;
  organizationId: string;
  channelId: string;
  externalContactId: string | null;
  normalizedContactHash: string;
  channelType: ChannelType;
  optInStatus: MessageOptInStatus;
  blockedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertMessagingContactPreferenceInput {
  organizationId: string;
  channelId: string;
  externalContactId?: string | null;
  normalizedContactHash: string;
  channelType: ChannelType;
  optInStatus?: MessageOptInStatus;
  metadata?: Record<string, unknown>;
}

/** Aggregate for the messaging section of the Channels dashboard. */
export interface MessagingChannelSummary {
  channelType: ChannelType;
  channel: EmployeeChannel | null;
  providerType: ChannelProviderType | null;
  credentialStatus: ChannelCredentialStatus | "not_configured";
  lastMessageAt: string | null;
}

export interface MessagingChannelOverview {
  summaries: MessagingChannelSummary[];
  recentWebhookEvents: ChannelWebhookEvent[];
}

// ===========================================================================
// Voice Call Channel (Prompt 010)
//
// Voice channels reuse employee_channels (channelType 'phone_call') + a voice
// provider. Caller numbers are salted-hashed; transcript content lives only in
// voice_call_transcript_messages; no raw audio is ever stored.
// ===========================================================================

export type VoiceProviderType =
  | "twilio_voice"
  | "telnyx_voice"
  | "vonage_voice"
  | "simulated_voice";

export type VoicePhoneNumberStatus = "draft" | "active" | "paused" | "archived";
export type VoiceCallDirection = "inbound" | "outbound";
export type VoiceCallStatus = "ringing" | "active" | "completed" | "failed" | "missed" | "blocked";
export type VoiceRecordingStatus = "disabled" | "pending" | "available" | "failed";
export type VoiceTranscriptStatus = "pending" | "partial" | "completed" | "failed";
export type VoiceSpeakerType = "caller" | "employee" | "system";

export type VoiceStreamEventType =
  | "call.webhook_received"
  | "call.started"
  | "call.answered"
  | "call.ended"
  | "call.failed"
  | "audio.stream_started"
  | "audio.stream_stopped"
  | "transcript.partial"
  | "transcript.final"
  | "voice.response_generated"
  | "voice.response_played"
  | "voice.response_failed";

export interface VoicePhoneNumber {
  id: string;
  organizationId: string;
  channelId: string;
  providerType: ChannelProviderType;
  phoneNumber: string;
  displayLabel: string | null;
  externalPhoneNumberId: string | null;
  countryCode: string | null;
  capabilities: Record<string, unknown>;
  status: VoicePhoneNumberStatus;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface CreateVoicePhoneNumberInput {
  organizationId: string;
  channelId: string;
  providerType: ChannelProviderType;
  phoneNumber: string;
  displayLabel?: string | null;
  externalPhoneNumberId?: string | null;
  countryCode?: string | null;
  capabilities?: Record<string, unknown>;
  status?: VoicePhoneNumberStatus;
  createdByUserId?: string | null;
}

export interface UpdateVoicePhoneNumberInput {
  phoneNumber?: string;
  displayLabel?: string | null;
  countryCode?: string | null;
  capabilities?: Record<string, unknown>;
  status?: VoicePhoneNumberStatus;
}

export interface VoiceCallSession {
  id: string;
  organizationId: string;
  employeeId: string;
  channelId: string;
  phoneNumberId: string | null;
  providerType: ChannelProviderType;
  externalCallId: string | null;
  direction: VoiceCallDirection;
  callerHash: string | null;
  callerLabel: string | null;
  status: VoiceCallStatus;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  endReason: string | null;
  recordingStatus: VoiceRecordingStatus;
  transcriptStatus: VoiceTranscriptStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVoiceCallSessionInput {
  organizationId: string;
  employeeId: string;
  channelId: string;
  phoneNumberId?: string | null;
  providerType: ChannelProviderType;
  externalCallId?: string | null;
  direction?: VoiceCallDirection;
  callerHash?: string | null;
  callerLabel?: string | null;
  status?: VoiceCallStatus;
  recordingStatus?: VoiceRecordingStatus;
  transcriptStatus?: VoiceTranscriptStatus;
  metadata?: Record<string, unknown>;
}

export interface UpdateVoiceCallSessionStatusInput {
  status?: VoiceCallStatus;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  endReason?: string | null;
  recordingStatus?: VoiceRecordingStatus;
  transcriptStatus?: VoiceTranscriptStatus;
  externalCallId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface VoiceTranscriptMessage {
  id: string;
  organizationId: string;
  employeeId: string;
  channelId: string;
  callSessionId: string;
  speakerType: VoiceSpeakerType;
  content: string;
  confidence: number | null;
  startedAtMs: number | null;
  endedAtMs: number | null;
  sourceReferences: ChatSourceReference[] | null;
  modelProviderSlug: string | null;
  modelId: string | null;
  estimatedCostUsd: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateVoiceTranscriptMessageInput {
  organizationId: string;
  employeeId: string;
  channelId: string;
  callSessionId: string;
  speakerType: VoiceSpeakerType;
  content: string;
  confidence?: number | null;
  startedAtMs?: number | null;
  endedAtMs?: number | null;
  sourceReferences?: ChatSourceReference[] | null;
  modelProviderSlug?: string | null;
  modelId?: string | null;
  estimatedCostUsd?: number | null;
  metadata?: Record<string, unknown>;
}

export interface VoiceStreamEvent {
  id: string;
  organizationId: string | null;
  employeeId: string | null;
  channelId: string | null;
  callSessionId: string | null;
  providerType: ChannelProviderType;
  eventType: VoiceStreamEventType;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateVoiceStreamEventInput {
  organizationId?: string | null;
  employeeId?: string | null;
  channelId?: string | null;
  callSessionId?: string | null;
  providerType: ChannelProviderType;
  eventType: VoiceStreamEventType;
  status?: string;
  metadata?: Record<string, unknown>;
}

/** Aggregate for the voice section of the Channels dashboard. */
export interface VoiceChannelOverview {
  channel: EmployeeChannel | null;
  providerType: ChannelProviderType | null;
  phoneNumber: VoicePhoneNumber | null;
  credentialStatus: ChannelCredentialStatus | "not_configured";
  callCount: number;
  lastCallAt: string | null;
  recentCalls: VoiceCallSession[];
}

// ===========================================================================
// Billing, Plans & Subscriptions (Sprint 015)
//
// Plan prices/entitlements are authoritative in code (modules/billing/plans.ts);
// only DYNAMIC state lives here: one subscription per organization, the mapping
// to an external billing customer, and a metadata-only audit of state changes.
// No card data, customer email, or raw provider payloads are ever stored.
// ===========================================================================

export type BillingSubscriptionStatus = "active" | "trialing" | "past_due" | "canceled";

/**
 * What happens when a managed org exceeds its period interaction quota (Sprint 017):
 *   - "hard_cap"      — block further interactions with an upgrade prompt (default).
 *   - "pay_as_you_go" — continue and meter each further managed interaction at the
 *                       managed per-interaction price, bounded by an optional cap.
 * Only meaningful for a `managed` org; a BYOK org is never metered for tokens.
 */
export const OVERAGE_POLICIES = ["hard_cap", "pay_as_you_go"] as const;
export type OveragePolicy = (typeof OVERAGE_POLICIES)[number];

export function isOveragePolicy(value: unknown): value is OveragePolicy {
  return typeof value === "string" && (OVERAGE_POLICIES as readonly string[]).includes(value);
}

/** One organization's current subscription. Exactly one active row per org. */
export interface BillingSubscription {
  id: string;
  organizationId: string;
  /** PlanId from the code catalog (validated on write). */
  planId: string;
  status: BillingSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  /** External provider ids (Stripe), or null in simulated mode. */
  externalSubscriptionId: string | null;
  externalCustomerId: string | null;
  /** "stripe" | "simulated" — which provider produced this state. */
  provider: string;
  /** Behavior past the interaction quota (Sprint 017). Defaults to hard_cap. */
  overagePolicy: OveragePolicy;
  /** Optional monthly overage spend ceiling in USD (owner-set). Null = no cap. */
  overageSpendCapUsd: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBillingSubscriptionInput {
  organizationId: string;
  planId: string;
  status?: BillingSubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  externalSubscriptionId?: string | null;
  externalCustomerId?: string | null;
  provider?: string;
  overagePolicy?: OveragePolicy;
  overageSpendCapUsd?: number | null;
}

export interface UpdateBillingSubscriptionInput {
  planId?: string;
  status?: BillingSubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  externalSubscriptionId?: string | null;
  externalCustomerId?: string | null;
  provider?: string;
  overagePolicy?: OveragePolicy;
  overageSpendCapUsd?: number | null;
}

/** Status of a metered overage line (Sprint 017). */
export const OVERAGE_ITEM_STATUSES = ["pending", "reported", "charged"] as const;
export type OverageItemStatus = (typeof OVERAGE_ITEM_STATUSES)[number];

/**
 * A metered overage line — one billable interaction past quota for a managed
 * pay-as-you-go org. Metadata only (no card data). Amount = quantity × unit price
 * snapshot so it stays accurate if the catalog price later changes.
 */
export interface BillingOverageItem {
  id: string;
  organizationId: string;
  /** The subscription period this line belongs to (currentPeriodStart). */
  periodStart: string;
  quantity: number;
  unitPriceUsd: number;
  amountUsd: number;
  status: OverageItemStatus;
  /** "stripe" | "simulated" — simulated lines are accrued but never charged. */
  provider: string;
  /** Opaque provider usage-record id once reported (metadata only). */
  externalUsageRecordId: string | null;
  createdAt: string;
}

export interface CreateBillingOverageItemInput {
  organizationId: string;
  periodStart: string;
  quantity: number;
  unitPriceUsd: number;
  amountUsd: number;
  provider: string;
  status?: OverageItemStatus;
  externalUsageRecordId?: string | null;
}

/**
 * Cross-tenant per-organization overage aggregate for the operator margin view
 * (Sprint 017). OPERATOR-ONLY — never queried from a tenant route.
 */
export interface OverageAggregateRow {
  organizationId: string;
  quantity: number;
  amountUsd: number;
}

/** Organization ↔ external billing customer mapping (never client-supplied). */
export interface BillingCustomer {
  id: string;
  organizationId: string;
  externalCustomerId: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertBillingCustomerInput {
  organizationId: string;
  externalCustomerId: string;
  provider: string;
}

/** Metadata-only audit of a billing state change. Never raw provider payloads. */
export interface BillingEvent {
  id: string;
  organizationId: string;
  eventType: string;
  planId: string | null;
  status: BillingSubscriptionStatus | null;
  provider: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateBillingEventInput {
  organizationId: string;
  eventType: string;
  planId?: string | null;
  status?: BillingSubscriptionStatus | null;
  provider: string;
  metadata?: Record<string, unknown>;
}

/* ==========================================================================
   Onboarding (Sprint 020) — first-run activation.
   ========================================================================== */

/**
 * Per-organization onboarding state. The activation checklist derives *step*
 * completion from real data (hired Employees, published DNA, Knowledge Vault
 * sources, chat tests, live web channels) — this record only holds the two bits
 * that cannot be derived: whether the org has dismissed the checklist, and when
 * it first became fully complete (so the completion milestone is audited once).
 * Org-scoped: the organization id is the primary key.
 */
export interface OrganizationOnboardingProgress {
  organizationId: string;
  /** When the checklist was dismissed, or null if it is showing. Resumable. */
  dismissedAt: string | null;
  /** When all required steps were first complete (milestone), or null. */
  completedAt: string | null;
  /** Last member who dismissed/resumed/completed, for the audit trail. */
  updatedByUserId: string | null;
  updatedAt: string;
}
