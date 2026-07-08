/**
 * Model Hub + LLM Gateway types (Prompt 006B).
 *
 * These describe the provider-agnostic runtime contract. Business/UI code depends
 * only on these types and the gateway interface — never on a provider SDK. That
 * keeps Taurus AI free to switch or mix providers (OpenAI, Anthropic, DeepSeek,
 * Kimi, Groq/Llama, Gemini, Fireworks, custom) without touching product code.
 */

import type {
  ChannelType,
  LlmTaskType,
  ModelTier,
  ProviderSlug,
  ProviderType,
  RoutingMode,
} from "@/lib/db/types";

/** Capability flags used for filtering + validation. */
export type ModelCapability =
  | "text"
  | "vision"
  | "audio"
  | "tools"
  | "json"
  | "streaming"
  | "reasoning"
  | "caching";

/** A provider entry in the catalog (code-authoritative for this sprint). */
export interface ModelProvider {
  slug: ProviderSlug;
  displayName: string;
  providerType: ProviderType;
  status: "available" | "disabled";
  defaultBaseUrl: string | null;
  supportsPlatformKey: boolean;
  supportsByok: boolean;
  documentationUrl: string | null;
  /** Server-only env var that holds the Taurus-managed key for this provider. */
  platformKeyEnvVar: string | null;
}

/** A model entry in the catalog. */
export interface AiModel {
  providerSlug: ProviderSlug;
  modelId: string;
  displayName: string;
  modelFamily: string;
  status: "available" | "deprecated";
  modelTier: ModelTier;
  recommendedFor: string;
  contextWindowTokens: number | null;
  maxOutputTokens: number | null;
  supportsText: boolean;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsTools: boolean;
  supportsJson: boolean;
  supportsStreaming: boolean;
  supportsReasoning: boolean;
  supportsCaching: boolean;
  inputUsdPerMillionTokens: number | null;
  cachedInputUsdPerMillionTokens: number | null;
  outputUsdPerMillionTokens: number | null;
  pricingNotes: string | null;
  pricingSourceUrl: string | null;
  priceCheckedAt: string | null;
}

/** Token usage passed to the cost estimator. */
export interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

/** Result of a cost estimation. `unknown` when the model has no price data. */
export interface CostEstimate {
  status: "known" | "unknown";
  totalUsd: number | null;
  inputUsd: number | null;
  cachedInputUsd: number | null;
  outputUsd: number | null;
  currency: "USD";
}

/** A single chat message. Content is used at runtime but never persisted. */
export interface GatewayMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Request into the gateway. `organizationId` is always supplied server-side. */
export interface GatewayRequest {
  organizationId: string;
  employeeId?: string | null;
  taskType: LlmTaskType;
  messages: GatewayMessage[];
  desiredRoutingMode?: RoutingMode | null;
  requiredCapabilities?: ModelCapability[];
  maxOutputTokens?: number | null;
  createdByUserId?: string | null;
  /** Deployment channel this interaction came through (for usage breakdowns). */
  channelType?: ChannelType | null;
  /**
   * When false, the gateway does NOT persist a usage event — the caller records
   * cost itself (e.g. Performance Review writes its own usage-cost event). Default
   * true. Sprint 018.
   */
  persistUsage?: boolean;
  metadata?: Record<string, string | number | boolean | null>;
}

/** Response from the gateway. Raw provider payloads are never included. */
export interface GatewayResponse {
  text: string;
  providerSlug: ProviderSlug;
  modelId: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd: number | null;
  /** True when the interaction ran on the customer's own key (Sprint 016/018). */
  byok?: boolean;
  latencyMs: number;
  rawProviderRequestId?: string | null;
  finishReason?: string | null;
  /** True when answered by the Local Demo Brain (dev/test only, never prod). */
  demo?: boolean;
  /** Human label for the brain that answered (e.g. "Local demo brain"). */
  brainLabel?: string | null;
}

/** Result of resolving which model should serve a request. */
export interface ModelResolution {
  model: AiModel | null;
  providerSlug: ProviderSlug | null;
  routingMode: RoutingMode;
  /** Human-readable, non-technical reason for the choice (for admin display). */
  reason: string;
}

/** Low-level, provider-facing generate input. `apiKey` never leaves the server. */
export interface ProviderGenerateInput {
  modelId: string;
  system: string | null;
  messages: GatewayMessage[];
  maxOutputTokens: number | null;
  apiKey: string;
  baseUrl: string | null;
}

/** Low-level, provider-facing generate result. */
export interface ProviderGenerateResult {
  text: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  rawProviderRequestId?: string | null;
  finishReason?: string | null;
}

/**
 * Common provider adapter interface. Every provider (OpenAI, Anthropic, DeepSeek,
 * Kimi, Groq, Gemini, Fireworks, custom) implements this. Business logic must not
 * import provider SDKs directly — Prompt 007 can consume the gateway instead.
 */
export interface LLMProvider {
  slug: ProviderSlug;
  generateText(input: ProviderGenerateInput): Promise<ProviderGenerateResult>;
  /** Streaming is foundation-only this sprint; optional. */
  streamText?(input: ProviderGenerateInput): AsyncIterable<{ delta: string }>;
}

/** Resolved credential for a provider (server-only). */
export interface ResolvedCredential {
  apiKey: string;
  baseUrl: string | null;
  mode: "taurus_managed" | "bring_your_own_key";
}

/** Resolves the runtime credential for a provider, or null if unavailable. */
export type CredentialResolver = (
  organizationId: string,
  providerSlug: ProviderSlug,
) => Promise<ResolvedCredential | null>;
