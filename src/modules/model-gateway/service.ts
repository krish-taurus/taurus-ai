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
import { getModel, getProvider } from "@/modules/model-gateway/catalog";
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
  const { providerSlug, apiKey } = parsed.data;

  const provider = getProvider(providerSlug);
  if (!provider || !provider.supportsByok) {
    throw new ModelHubValidationError("This provider does not support your own key.");
  }
  if (!isEncryptionConfigured()) {
    throw new ModelHubValidationError(
      "Secure key storage is not configured, so your own key cannot be saved yet.",
    );
  }

  const encryptedApiKey = await encryptApiKey(apiKey);
  const saved = await store.saveProviderCredential({
    organizationId: actor.organizationId,
    providerSlug,
    credentialMode: "bring_your_own_key",
    encryptedApiKey,
    keyLastFour: lastFour(apiKey),
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
    targetId: providerSlug,
    metadata: {
      providerSlug,
      credentialMode: "bring_your_own_key",
      keyLastFour: saved.keyLastFour,
    },
  });

  return saved;
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
    targetId: providerSlug,
    metadata: { providerSlug },
  });
}
