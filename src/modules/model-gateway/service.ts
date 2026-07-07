/**
 * Model Hub domain service (Prompt 006B) — server only.
 *
 * Validates + applies organization/employee model settings and provider
 * credentials, and emits metadata-only audit events. API keys are encrypted
 * before storage and never logged. All inputs are validated against the catalog
 * so callers cannot reference unknown models/providers.
 */

import type { DataStore } from "@/lib/db/store";
import type {
  EmployeeModelSettings,
  OrganizationModelSettings,
  ProviderCredentialMetadata,
  ProviderSlug,
} from "@/lib/db/types";
import { getModel, getProvider, modelsByProvider } from "@/modules/model-gateway/catalog";
import { createDefaultCredentialResolver } from "@/modules/model-gateway/credential-resolver";
import { DEFAULT_PROVIDERS } from "@/modules/model-gateway/providers";
import { BRAIN_MODES_BY_ID, type BrainMode } from "@/modules/model-gateway/metadata";
import {
  employeeBrainSchema,
  organizationModelSettingsSchema,
  saveProviderCredentialSchema,
} from "@/modules/model-gateway/schema";
import {
  encryptApiKey,
  isEncryptionConfigured,
  lastFour,
} from "@/modules/model-gateway/credentials";
import { costTierForModelId } from "@/modules/usage/model-pricing";

export interface ModelHubActor {
  organizationId: string;
  userId: string;
}

export class ModelHubValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelHubValidationError";
  }
}

function assertKnownModel(modelId: string | null): void {
  if (modelId && !getModel(modelId)) {
    throw new ModelHubValidationError("That model is not in the catalog.");
  }
}

/** Update organization-level default model configuration. */
export async function updateOrganizationModelSettings(
  store: DataStore,
  actor: ModelHubActor,
  input: unknown,
): Promise<OrganizationModelSettings> {
  const parsed = organizationModelSettingsSchema.safeParse(input);
  if (!parsed.success) {
    throw new ModelHubValidationError(
      parsed.error.issues[0]?.message ?? "Please check the model settings.",
    );
  }
  const values = parsed.data;
  assertKnownModel(values.defaultModelId);
  assertKnownModel(values.fallbackModelId);

  const previous = await store.getOrganizationModelSettings(actor.organizationId);

  const updated = await store.updateOrganizationModelSettings(actor.organizationId, {
    routingMode: values.routingMode,
    defaultModelId: values.defaultModelId,
    fallbackModelId: values.fallbackModelId,
    allowedProviderSlugs: values.allowedProviderSlugs,
    blockedProviderSlugs: values.blockedProviderSlugs,
    monthlyBudgetUsd: values.monthlyBudgetUsd,
    budgetAlertThresholdPercent: values.budgetAlertThresholdPercent,
    updatedByUserId: actor.userId,
  });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "model_settings.updated",
    targetType: "organization",
    targetId: actor.organizationId,
    metadata: {
      routingMode: updated.routingMode,
      defaultModelId: updated.defaultModelId,
      allowedProviderCount: updated.allowedProviderSlugs.length,
      blockedProviderCount: updated.blockedProviderSlugs.length,
    },
  });

  // Emit a distinct budget event when the monthly budget changed.
  if (previous.monthlyBudgetUsd !== updated.monthlyBudgetUsd) {
    await store.createAuditEvent({
      organizationId: actor.organizationId,
      actorType: "user",
      actorId: actor.userId,
      action: "model_budget.updated",
      targetType: "organization",
      targetId: actor.organizationId,
      metadata: {
        monthlyBudgetUsd: updated.monthlyBudgetUsd,
        budgetAlertThresholdPercent: updated.budgetAlertThresholdPercent,
      },
    });
  }

  return updated;
}

/** Update an employee's brain (inherit, a simple mode, or an exact model). */
export async function updateEmployeeBrain(
  store: DataStore,
  actor: ModelHubActor,
  employeeId: string,
  input: unknown,
): Promise<EmployeeModelSettings> {
  const employee = await store.getEmployee(actor.organizationId, employeeId);
  if (!employee) {
    throw new ModelHubValidationError("Employee not found.");
  }

  const parsed = employeeBrainSchema.safeParse(input);
  if (!parsed.success) {
    throw new ModelHubValidationError(
      parsed.error.issues[0]?.message ?? "Please check the brain settings.",
    );
  }
  const { selection, modelId } = parsed.data;

  let patch: Parameters<DataStore["updateEmployeeModelSettings"]>[2];
  if (selection === "inherit") {
    patch = { modelId: null, routingMode: null, updatedByUserId: actor.userId };
  } else if (selection === "advanced") {
    assertKnownModel(modelId);
    // Margin guardrail (Sprint 016): frontier-tier models are BYOK-only. A
    // managed org cannot pin an AI Employee to a frontier model — it must switch
    // to its own key first. Budget + Standard models remain fully selectable.
    if (costTierForModelId(modelId) === "frontier") {
      const org = await store.getOrganizationById(actor.organizationId);
      if ((org?.modelAccessMode ?? "managed") === "managed") {
        throw new ModelHubValidationError(
          "Premium models require your own API key. Switch this organization to " +
            "bring-your-own-key in the Model Hub to use a premium model, or choose a " +
            "Budget or Standard model.",
        );
      }
    }
    patch = { modelId, routingMode: "manual", updatedByUserId: actor.userId };
  } else {
    const mode = BRAIN_MODES_BY_ID[selection as BrainMode];
    patch = { modelId: null, routingMode: mode.routingMode, updatedByUserId: actor.userId };
  }

  const updated = await store.updateEmployeeModelSettings(actor.organizationId, employeeId, patch);

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "employee_brain.updated",
    targetType: "employee",
    targetId: employeeId,
    metadata: {
      selection,
      routingMode: updated.routingMode,
      modelId: updated.modelId,
    },
  });

  return updated;
}

/** Save a bring-your-own-key credential (encrypted at rest). */
export async function saveProviderCredential(
  store: DataStore,
  actor: ModelHubActor,
  input: unknown,
): Promise<ProviderCredentialMetadata> {
  const parsed = saveProviderCredentialSchema.safeParse(input);
  if (!parsed.success) {
    throw new ModelHubValidationError(
      parsed.error.issues[0]?.message ?? "Please check the provider key.",
    );
  }
  const { providerSlug, apiKey, baseUrl, label } = parsed.data;

  const provider = getProvider(providerSlug);
  if (!provider || !provider.supportsByok) {
    throw new ModelHubValidationError("This provider does not support your own key.");
  }
  if (!isEncryptionConfigured()) {
    throw new ModelHubValidationError(
      "Secure key storage is not configured, so your own key cannot be saved yet.",
    );
  }
  // The custom OpenAI-compatible provider has no default endpoint, so a base URL
  // is required. Other providers ignore any supplied base URL (they have one).
  const requiresBaseUrl = provider.defaultBaseUrl === null;
  if (requiresBaseUrl && !baseUrl) {
    throw new ModelHubValidationError(
      "Enter the base URL for this custom OpenAI-compatible endpoint.",
    );
  }
  const effectiveBaseUrl = requiresBaseUrl ? baseUrl : null;

  const encryptedApiKey = await encryptApiKey(apiKey);
  const saved = await store.saveProviderCredential({
    organizationId: actor.organizationId,
    providerSlug,
    credentialMode: "bring_your_own_key",
    encryptedApiKey,
    keyLastFour: lastFour(apiKey),
    baseUrl: effectiveBaseUrl,
    label,
    status: "active",
    userId: actor.userId,
  });

  // Audit metadata only — never the key, never the encrypted value.
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "provider_credential.saved",
    targetType: "provider",
    // A provider is identified by its slug (kept in metadata), not a UUID.
    // target_id is a uuid column, so it must stay null here.
    targetId: null,
    metadata: {
      providerSlug,
      credentialMode: "bring_your_own_key",
      keyLastFour: saved.keyLastFour,
      hasCustomBaseUrl: effectiveBaseUrl !== null,
      label: saved.label,
    },
  });

  return saved;
}

/**
 * A single probe of a provider connection. Given a resolved credential and a
 * model id, it should complete without throwing when the connection works.
 * Injectable so tests can verify the flow WITHOUT any network call — the default
 * uses the real provider adapter and is only reached from the server action.
 */
export interface ProviderProbeInput {
  providerSlug: ProviderSlug;
  apiKey: string;
  baseUrl: string | null;
  modelId: string;
}
export type ProviderConnectionProbe = (input: ProviderProbeInput) => Promise<void>;

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

/** Default probe: a minimal, real adapter call. Never used in tests. */
async function defaultConnectionProbe(input: ProviderProbeInput): Promise<void> {
  const provider = DEFAULT_PROVIDERS[input.providerSlug];
  await provider.generateText({
    modelId: input.modelId,
    system: null,
    messages: [{ role: "user", content: "ping" }],
    maxOutputTokens: 1,
    apiKey: input.apiKey,
    baseUrl: input.baseUrl,
  });
}

/**
 * Optionally test a provider connection using the resolved organization
 * credential (BYOK or Taurus-managed). Returns a safe, non-technical result and
 * records a metadata-only audit event. Never returns the key or the raw provider
 * error, and never throws for an ordinary connection failure.
 */
export async function testProviderConnection(
  store: DataStore,
  actor: ModelHubActor,
  providerSlug: ProviderSlug,
  options: { probe?: ProviderConnectionProbe } = {},
): Promise<ConnectionTestResult> {
  const provider = getProvider(providerSlug);
  if (!provider) {
    throw new ModelHubValidationError("Unknown provider.");
  }

  const resolveCredential = createDefaultCredentialResolver(store);
  const credential = await resolveCredential(actor.organizationId, providerSlug);
  if (!credential) {
    return { ok: false, message: "No usable key is configured for this provider yet." };
  }

  const model = modelsByProvider(providerSlug)[0];
  if (!model) {
    return {
      ok: false,
      message: "Connection testing is not available for this provider yet.",
    };
  }

  const probe = options.probe ?? defaultConnectionProbe;
  let ok = false;
  try {
    await probe({
      providerSlug,
      apiKey: credential.apiKey,
      baseUrl: credential.baseUrl,
      modelId: model.modelId,
    });
    ok = true;
  } catch {
    // Swallow the raw error — it may reference the endpoint and must not be
    // surfaced. The generic message below is safe for the UI.
    ok = false;
  }

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "provider_credential.tested",
    targetType: "provider",
    // A provider is identified by its slug (kept in metadata), not a UUID.
    // target_id is a uuid column, so it must stay null here.
    targetId: null,
    metadata: { providerSlug, mode: credential.mode, ok },
  });

  return ok
    ? { ok: true, message: "Connection successful." }
    : { ok: false, message: "Connection failed. Check the key and endpoint, then try again." };
}

/** Disable a provider credential and drop stored key material. */
export async function disableProviderCredential(
  store: DataStore,
  actor: ModelHubActor,
  providerSlug: ProviderSlug,
): Promise<void> {
  await store.disableProviderCredential(actor.organizationId, providerSlug, actor.userId);
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "provider_credential.disabled",
    targetType: "provider",
    // A provider is identified by its slug (kept in metadata), not a UUID.
    // target_id is a uuid column, so it must stay null here.
    targetId: null,
    metadata: { providerSlug },
  });
}
