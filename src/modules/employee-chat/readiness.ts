/**
 * Chat readiness (Prompt 007) — server only.
 *
 * Computes whether an employee can be chatted with, and why not if it can't. This
 * drives the profile checklist and the chat page gates (publish DNA / assign
 * knowledge / configure Model Hub in production).
 */

import type { AiEmployee, EmployeeDnaVersion } from "@/lib/db/types";
import type { DataStore } from "@/lib/db/store";
import {
  createLlmGateway,
  isLiveProviderConfigured as defaultIsLiveProviderConfigured,
  isProductionRuntime,
  listConfiguredProviderSlugs,
} from "@/modules/model-gateway/credential-resolver";
import type { ProviderSlug } from "@/lib/db/types";
import type { ChatBlockReason } from "@/modules/employee-chat/metadata";

export interface ChatReadiness {
  employeeArchived: boolean;
  dnaPublished: boolean;
  publishedDna: EmployeeDnaVersion | null;
  assignedKnowledgeCount: number;
  preparedExcerptCount: number;
  liveProviderAvailable: boolean;
  demoAllowed: boolean;
  brainMode: "live" | "local_demo" | "unavailable";
  resolvedModelLabel: string | null;
  canChat: boolean;
  blockReason: ChatBlockReason | null;
}

export interface ReadinessDeps {
  resolveProviderSlug?: (
    organizationId: string,
    employeeId: string,
  ) => Promise<{ providerSlug: ProviderSlug | null; modelLabel: string | null }>;
  isLiveProviderConfigured?: (
    store: DataStore,
    organizationId: string,
    providerSlug: ProviderSlug | null,
  ) => Promise<boolean>;
  /** Providers the org has a usable credential for (BYOK active or managed env). */
  listConfiguredProviders?: (store: DataStore, organizationId: string) => Promise<ProviderSlug[]>;
  isProduction?: () => boolean;
}

export async function computeChatReadiness(
  store: DataStore,
  params: { organizationId: string; employee: AiEmployee },
  deps: ReadinessDeps = {},
): Promise<ChatReadiness> {
  const { organizationId, employee } = params;

  const resolveProviderSlug =
    deps.resolveProviderSlug ??
    (async (orgId: string, employeeId: string) => {
      const gateway = createLlmGateway(store);
      const resolution = await gateway.resolveModelForTask({
        organizationId: orgId,
        employeeId,
        taskType: "employee_chat",
        messages: [],
      });
      return {
        providerSlug: resolution.providerSlug,
        modelLabel: resolution.model?.displayName ?? null,
      };
    });
  const isLiveProviderConfigured = deps.isLiveProviderConfigured ?? defaultIsLiveProviderConfigured;
  const listConfiguredProviders = deps.listConfiguredProviders ?? listConfiguredProviderSlugs;
  const isProduction = deps.isProduction ?? isProductionRuntime;

  const [published, assignedSources, segments, resolved, configuredProviders] = await Promise.all([
    store.getPublishedEmployeeDna(organizationId, employee.id),
    store.listKnowledgeSourcesForEmployee(organizationId, employee.id),
    store.listKnowledgeRetrievalSegmentsForEmployee(organizationId, employee.id),
    resolveProviderSlug(organizationId, employee.id),
    listConfiguredProviders(store, organizationId),
  ]);

  const assignedKnowledgeCount = assignedSources.filter((s) => s.status !== "archived").length;
  const liveProviderAvailable = await isLiveProviderConfigured(
    store,
    organizationId,
    resolved.providerSlug,
  );
  const demoAllowed = !isProduction();
  const brainMode: ChatReadiness["brainMode"] = liveProviderAvailable
    ? "live"
    : demoAllowed
      ? "local_demo"
      : "unavailable";

  const employeeArchived = employee.status === "archived";
  const dnaPublished = !!published;
  const hasConfiguredProvider = configuredProviders.length > 0;

  // Message precedence maps to the two distinct setup states:
  //   - a provider key exists but no model resolves → choose an Employee Brain
  //   - no provider key (model may or may not resolve) → connect a provider
  let blockReason: ChatBlockReason | null = null;
  if (employeeArchived) blockReason = "archived";
  else if (!dnaPublished) blockReason = "needs_dna";
  else if (!resolved.providerSlug)
    blockReason = hasConfiguredProvider ? "no_model" : "needs_model_hub";
  else if (brainMode === "unavailable") blockReason = "needs_model_hub";

  return {
    employeeArchived,
    dnaPublished,
    publishedDna: published,
    assignedKnowledgeCount,
    preparedExcerptCount: segments.length,
    liveProviderAvailable,
    demoAllowed,
    brainMode,
    resolvedModelLabel: resolved.modelLabel,
    canChat: blockReason === null,
    blockReason,
  };
}
