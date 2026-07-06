"use server";

/**
 * Model Hub server actions (Prompt 006B).
 *
 * SECURITY: authentication + organization are resolved server-side via
 * requireCurrentOrganization(); organizationId is never taken from the client.
 * Every action re-checks the model_hub.manage permission. API keys are encrypted
 * in the service and never returned or logged. No external API calls happen here.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import type { ProviderSlug } from "@/lib/db/types";
import {
  disableProviderCredential,
  saveProviderCredential,
  updateEmployeeBrain,
  updateOrganizationModelSettings,
  type ModelHubActor,
} from "@/modules/model-gateway/service";
import { PROVIDER_SLUGS } from "@/modules/model-gateway/schema";

export interface ModelHubActionState {
  error?: string;
  ok?: boolean;
}

const DENIED = "You do not have permission to manage the Model Hub in this organization.";

async function requireManage(): Promise<{ ok: true; actor: ModelHubActor } | { ok: false }> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "model_hub.manage")) {
    return { ok: false };
  }
  return { ok: true, actor: { organizationId: organization.id, userId: user.id } };
}

function readProviderList(formData: FormData, field: string): ProviderSlug[] {
  const valid = new Set<string>(PROVIDER_SLUGS);
  return formData
    .getAll(field)
    .map((v) => String(v))
    .filter((v) => valid.has(v)) as ProviderSlug[];
}

export async function updateOrganizationModelSettingsAction(
  _prevState: ModelHubActionState,
  formData: FormData,
): Promise<ModelHubActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  try {
    await updateOrganizationModelSettings(getStore(), ctx.actor, {
      routingMode: formData.get("routingMode"),
      defaultModelId: formData.get("defaultModelId") ?? "",
      fallbackModelId: formData.get("fallbackModelId") ?? "",
      allowedProviderSlugs: readProviderList(formData, "allowedProviderSlugs"),
      blockedProviderSlugs: readProviderList(formData, "blockedProviderSlugs"),
      monthlyBudgetUsd: formData.get("monthlyBudgetUsd") ?? "",
      budgetAlertThresholdPercent: formData.get("budgetAlertThresholdPercent") ?? "",
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the model settings." };
  }

  revalidatePath("/dashboard/settings/models");
  redirect("/dashboard/settings/models");
}

export async function updateEmployeeBrainAction(
  _prevState: ModelHubActionState,
  formData: FormData,
): Promise<ModelHubActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) return { error: "Missing employee." };

  try {
    await updateEmployeeBrain(getStore(), ctx.actor, employeeId, {
      selection: formData.get("selection"),
      modelId: formData.get("modelId") ?? "",
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the brain settings." };
  }

  revalidatePath(`/dashboard/employees/${employeeId}/brain`);
  revalidatePath(`/dashboard/employees/${employeeId}`);
  redirect(`/dashboard/employees/${employeeId}`);
}

export async function saveProviderCredentialAction(
  _prevState: ModelHubActionState,
  formData: FormData,
): Promise<ModelHubActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  try {
    await saveProviderCredential(getStore(), ctx.actor, {
      providerSlug: formData.get("providerSlug"),
      apiKey: formData.get("apiKey"),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save the provider key." };
  }

  revalidatePath("/dashboard/settings/models/providers");
  redirect("/dashboard/settings/models/providers");
}

export async function disableProviderCredentialAction(
  _prevState: ModelHubActionState,
  formData: FormData,
): Promise<ModelHubActionState> {
  const ctx = await requireManage();
  if (!ctx.ok) return { error: DENIED };

  const providerSlug = String(formData.get("providerSlug") ?? "");
  if (!(PROVIDER_SLUGS as readonly string[]).includes(providerSlug)) {
    return { error: "Unknown provider." };
  }

  try {
    await disableProviderCredential(getStore(), ctx.actor, providerSlug as ProviderSlug);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not disable the provider key." };
  }

  revalidatePath("/dashboard/settings/models/providers");
  redirect("/dashboard/settings/models/providers");
}
