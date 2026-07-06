/**
 * Internal LLM Gateway (Prompt 006B).
 *
 * The single seam between Taurus product code and any model provider. Business
 * logic calls the gateway; the gateway resolves the model + credential, invokes
 * the right provider adapter, estimates cost, and records a metadata-only usage
 * event. It NEVER exposes raw provider responses and NEVER logs message contents.
 *
 * Providers and the credential resolver are injected, so tests exercise the full
 * path with fakes and no external API calls ever happen.
 */

import type { DataStore } from "@/lib/db/store";
import type { ProviderSlug } from "@/lib/db/types";
import type {
  AiModel,
  CostEstimate,
  CredentialResolver,
  GatewayMessage,
  GatewayRequest,
  GatewayResponse,
  LLMProvider,
  ModelResolution,
  ProviderGenerateInput,
  ProviderGenerateResult,
  TokenUsage,
} from "@/modules/model-gateway/types";
import { getModel } from "@/modules/model-gateway/catalog";
import { estimateCost } from "@/modules/model-gateway/pricing";
import { modelSupportsCapabilities, resolveModelForTask } from "@/modules/model-gateway/router";

/** Raised when the gateway cannot serve a request (config/credential issues). */
export class GatewayError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

export interface LlmGatewayDeps {
  store: DataStore;
  providers: Record<ProviderSlug, LLMProvider>;
  resolveCredential: CredentialResolver;
  /**
   * Local Demo Brain (Prompt 007). When no real provider credential resolves and
   * `allowed` is true (local dev / tests only), the gateway answers with this
   * deterministic brain instead of throwing. It is NEVER allowed in production,
   * so demo responses are never served silently to real users.
   */
  demo?: {
    allowed: boolean;
    generate: (input: ProviderGenerateInput) => ProviderGenerateResult;
  };
  /** Injectable clock for deterministic latency in tests. */
  now?: () => number;
}

/** Rough token estimate used only when the provider omits usage numbers. */
function estimateTokens(text: string): number {
  return Math.max(0, Math.ceil(text.length / 4));
}

function systemFrom(messages: GatewayMessage[]): string | null {
  const parts = messages.filter((m) => m.role === "system").map((m) => m.content);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

/** Non-reversible short hash of a provider request id (never message content). */
function shortHash(value: string | null | undefined): string | null {
  if (!value) return null;
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

export class LlmGateway {
  private readonly now: () => number;

  constructor(private readonly deps: LlmGatewayDeps) {
    this.now = deps.now ?? (() => Date.now());
  }

  /** Deterministic cost estimate for a model + token usage. */
  estimateCost(modelId: string, usage: TokenUsage): CostEstimate {
    const model = getModel(modelId);
    if (!model) {
      return {
        status: "unknown",
        totalUsd: null,
        inputUsd: null,
        cachedInputUsd: null,
        outputUsd: null,
        currency: "USD",
      };
    }
    return estimateCost(model, usage);
  }

  /** Resolve which model should serve this request (org + employee settings). */
  async resolveModelForTask(request: GatewayRequest): Promise<ModelResolution> {
    const orgSettings = await this.deps.store.getOrganizationModelSettings(request.organizationId);
    const employeeSettings = request.employeeId
      ? await this.deps.store.getEmployeeModelSettings(request.organizationId, request.employeeId)
      : null;

    return resolveModelForTask({
      orgSettings,
      employeeSettings,
      desiredRoutingMode: request.desiredRoutingMode ?? null,
      requiredCapabilities: request.requiredCapabilities,
    });
  }

  /** Validate that the resolved model supports the task's required capabilities. */
  async validateModelSupportsTask(
    request: GatewayRequest,
  ): Promise<{ ok: boolean; reason: string; resolution: ModelResolution }> {
    const resolution = await this.resolveModelForTask(request);
    if (!resolution.model) {
      return { ok: false, reason: resolution.reason, resolution };
    }
    const ok = modelSupportsCapabilities(resolution.model, request.requiredCapabilities);
    return {
      ok,
      reason: ok
        ? "ok"
        : `${resolution.model.displayName} does not support all required capabilities.`,
      resolution,
    };
  }

  /**
   * Generate text for a task. Foundation-only: resolves + calls a provider adapter
   * and records a metadata-only usage event. Not wired to any UI this sprint.
   */
  async generateText(request: GatewayRequest): Promise<GatewayResponse> {
    const resolution = await this.resolveModelForTask(request);
    const model = resolution.model;
    if (!model || !resolution.providerSlug) {
      throw new GatewayError(resolution.reason, "no_eligible_model");
    }
    const providerSlug = resolution.providerSlug;

    if (!modelSupportsCapabilities(model, request.requiredCapabilities)) {
      throw new GatewayError(
        `${model.displayName} does not support all required capabilities.`,
        "capability_mismatch",
      );
    }

    const credential = await this.deps.resolveCredential(request.organizationId, providerSlug);
    if (!credential) {
      // No real provider configured. In dev/test, fall back to the Local Demo
      // Brain (behind the gateway). In production this stays a hard error so we
      // never silently serve fake answers.
      if (this.deps.demo?.allowed) {
        return this.runDemo(request, model, providerSlug);
      }
      throw new GatewayError(
        `Provider ${providerSlug} is not configured for this organization.`,
        "provider_not_configured",
      );
    }

    const provider = this.deps.providers[providerSlug];
    if (!provider) {
      throw new GatewayError(`No adapter for provider ${providerSlug}.`, "no_adapter");
    }

    const start = this.now();
    try {
      const result = await provider.generateText({
        modelId: model.modelId,
        system: systemFrom(request.messages),
        messages: request.messages,
        maxOutputTokens: request.maxOutputTokens ?? model.maxOutputTokens,
        apiKey: credential.apiKey,
        baseUrl: credential.baseUrl,
      });
      const latencyMs = Math.max(0, this.now() - start);

      const inputTokens =
        result.inputTokens ??
        request.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
      const cachedInputTokens = result.cachedInputTokens ?? 0;
      const outputTokens = result.outputTokens ?? estimateTokens(result.text);

      const cost = estimateCost(model, { inputTokens, cachedInputTokens, outputTokens });

      // Metadata only — message contents are NEVER persisted.
      await this.deps.store.createLlmUsageEvent({
        organizationId: request.organizationId,
        employeeId: request.employeeId ?? null,
        providerSlug,
        modelId: model.modelId,
        taskType: request.taskType,
        inputTokens,
        cachedInputTokens,
        outputTokens,
        estimatedCostUsd: cost.totalUsd,
        latencyMs,
        status: "success",
        errorCode: null,
        requestIdHash: shortHash(result.rawProviderRequestId),
        createdByUserId: request.createdByUserId ?? null,
      });

      return {
        text: result.text,
        providerSlug,
        modelId: model.modelId,
        inputTokens,
        cachedInputTokens,
        outputTokens,
        estimatedCostUsd: cost.totalUsd,
        latencyMs,
        rawProviderRequestId: result.rawProviderRequestId ?? null,
        finishReason: result.finishReason ?? null,
      };
    } catch (error) {
      const latencyMs = Math.max(0, this.now() - start);
      const code = error instanceof GatewayError ? error.code : "provider_error";
      // Record the failure as metadata only (no message contents).
      await this.deps.store.createLlmUsageEvent({
        organizationId: request.organizationId,
        employeeId: request.employeeId ?? null,
        providerSlug,
        modelId: model.modelId,
        taskType: request.taskType,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: null,
        latencyMs,
        status: "error",
        errorCode: code,
        requestIdHash: null,
        createdByUserId: request.createdByUserId ?? null,
      });
      if (error instanceof GatewayError) throw error;
      throw new GatewayError("Provider request failed.", code);
    }
  }

  /** Answer via the Local Demo Brain and record a metadata-only (free) usage event. */
  private async runDemo(
    request: GatewayRequest,
    model: AiModel,
    providerSlug: ProviderSlug,
  ): Promise<GatewayResponse> {
    if (!this.deps.demo) {
      throw new GatewayError("Demo brain is not available.", "provider_not_configured");
    }
    const start = this.now();
    const result = this.deps.demo.generate({
      modelId: model.modelId,
      system: systemFrom(request.messages),
      messages: request.messages,
      maxOutputTokens: request.maxOutputTokens ?? model.maxOutputTokens,
      apiKey: "",
      baseUrl: null,
    });
    const latencyMs = Math.max(0, this.now() - start);
    const inputTokens = request.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    const outputTokens = estimateTokens(result.text);

    // Demo answers are free; still record usage metadata for consistency.
    await this.deps.store.createLlmUsageEvent({
      organizationId: request.organizationId,
      employeeId: request.employeeId ?? null,
      providerSlug,
      modelId: model.modelId,
      taskType: request.taskType,
      inputTokens,
      cachedInputTokens: 0,
      outputTokens,
      estimatedCostUsd: 0,
      latencyMs,
      status: "success",
      errorCode: null,
      requestIdHash: null,
      createdByUserId: request.createdByUserId ?? null,
    });

    return {
      text: result.text,
      providerSlug,
      modelId: model.modelId,
      inputTokens,
      cachedInputTokens: 0,
      outputTokens,
      estimatedCostUsd: 0,
      latencyMs,
      rawProviderRequestId: null,
      finishReason: result.finishReason ?? "stop",
      demo: true,
      brainLabel: "Local demo brain",
    };
  }
}
