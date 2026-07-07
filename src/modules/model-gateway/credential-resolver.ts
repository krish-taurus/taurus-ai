/**
 * Default runtime credential resolver + gateway factory (Prompt 006B) — SERVER ONLY.
 *
 * Resolution order for a provider:
 *   1. Bring-your-own-key: an active BYOK credential, decrypted (only when the
 *      encryption master key is configured).
 *   2. Taurus managed: the provider's server-only env key, if present and the
 *      org has not disabled the provider.
 *   3. Otherwise null — the provider is visible but not runnable.
 *
 * Missing keys must never break local dev or tests; they simply yield null.
 */

import type { DataStore } from "@/lib/db/store";
import type { ProviderSlug } from "@/lib/db/types";
import type { CredentialResolver, ResolvedCredential } from "@/modules/model-gateway/types";
import { getProvider, MODEL_PROVIDERS } from "@/modules/model-gateway/catalog";
import { decryptApiKey, isEncryptionConfigured } from "@/modules/model-gateway/credentials";
import { DEFAULT_PROVIDERS } from "@/modules/model-gateway/providers";
import { LlmGateway } from "@/modules/model-gateway/gateway";
import { generateLocalDemoAnswer } from "@/modules/model-gateway/local-demo-brain";

/** Whether a provider has a Taurus-managed key available via env. */
export function isPlatformKeyAvailable(providerSlug: ProviderSlug): boolean {
  const provider = getProvider(providerSlug);
  if (!provider?.platformKeyEnvVar) return false;
  const value = process.env[provider.platformKeyEnvVar];
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Whether an organization has a *usable* credential for a provider — either an
 * active bring-your-own-key credential (whose encrypted key is stored and
 * encryption is configured so it can be decrypted at runtime), or a
 * Taurus-managed env key. An active BYOK credential always has an encrypted key
 * (save sets it; disabling clears it and flips the mode), so the metadata alone
 * is authoritative — no plaintext or encrypted value is ever read here.
 */
export async function isProviderConfigured(
  store: DataStore,
  organizationId: string,
  providerSlug: ProviderSlug,
): Promise<boolean> {
  const meta = await store.getProviderCredentialMetadata(organizationId, providerSlug);
  if (
    meta &&
    meta.credentialMode === "bring_your_own_key" &&
    meta.status === "active" &&
    isEncryptionConfigured()
  ) {
    return true;
  }
  // An org that explicitly disabled a provider opts out of the managed env key.
  if (meta?.credentialMode === "disabled") return false;
  return isPlatformKeyAvailable(providerSlug);
}

/**
 * All provider slugs the organization has a usable credential for. Used to make
 * model routing credential-aware, so automatic modes only pick a model whose
 * provider can actually run. One credential query; no key material is read.
 */
export async function listConfiguredProviderSlugs(
  store: DataStore,
  organizationId: string,
): Promise<ProviderSlug[]> {
  const metas = await store.listProviderCredentialMetadata(organizationId);
  const activeByok = new Set(
    metas
      .filter((m) => m.credentialMode === "bring_your_own_key" && m.status === "active")
      .map((m) => m.providerSlug),
  );
  const disabled = new Set(
    metas.filter((m) => m.credentialMode === "disabled").map((m) => m.providerSlug),
  );

  const configured: ProviderSlug[] = [];
  for (const provider of MODEL_PROVIDERS) {
    if (activeByok.has(provider.slug) && isEncryptionConfigured()) {
      configured.push(provider.slug);
      continue;
    }
    if (!disabled.has(provider.slug) && isPlatformKeyAvailable(provider.slug)) {
      configured.push(provider.slug);
    }
  }
  return configured;
}

export function createDefaultCredentialResolver(store: DataStore): CredentialResolver {
  return async (organizationId, providerSlug): Promise<ResolvedCredential | null> => {
    const provider = getProvider(providerSlug);
    if (!provider) return null;

    const meta = await store.getProviderCredentialMetadata(organizationId, providerSlug);

    // 1. BYOK (only when encryption is configured and the credential is active).
    if (
      meta &&
      meta.credentialMode === "bring_your_own_key" &&
      meta.status === "active" &&
      isEncryptionConfigured()
    ) {
      const encrypted = await store.getProviderEncryptedKey(organizationId, providerSlug);
      if (encrypted) {
        const apiKey = await decryptApiKey(encrypted);
        // Prefer a stored custom base URL (e.g. an OpenAI-compatible endpoint),
        // falling back to the provider's default.
        return {
          apiKey,
          baseUrl: meta.baseUrl ?? provider.defaultBaseUrl,
          mode: "bring_your_own_key",
        };
      }
    }

    // 2. Taurus-managed env key (unless the org explicitly disabled the provider).
    if (meta?.credentialMode === "disabled") return null;
    if (provider.platformKeyEnvVar) {
      const envKey = process.env[provider.platformKeyEnvVar];
      if (envKey && envKey.trim().length > 0) {
        return { apiKey: envKey, baseUrl: provider.defaultBaseUrl, mode: "taurus_managed" };
      }
    }

    return null;
  };
}

/**
 * True only in production. Used to gate the Local Demo Brain so fake answers are
 * never served silently to real users.
 */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Build the default LLM gateway backed by real provider adapters. */
export function createLlmGateway(store: DataStore): LlmGateway {
  return new LlmGateway({
    store,
    providers: DEFAULT_PROVIDERS,
    resolveCredential: createDefaultCredentialResolver(store),
    // Credential-aware routing: automatic modes only pick a model whose provider
    // the organization actually has a usable key for (BYOK or Taurus-managed).
    listAvailableProviders: (organizationId) => listConfiguredProviderSlugs(store, organizationId),
    // Local Demo Brain is allowed everywhere EXCEPT production.
    demo: { allowed: !isProductionRuntime(), generate: generateLocalDemoAnswer },
  });
}

/**
 * Whether a live provider credential resolves for the model a request would use.
 * Drives the chat readiness state (live vs demo vs "configure Model Hub").
 */
export async function isLiveProviderConfigured(
  store: DataStore,
  organizationId: string,
  providerSlug: ProviderSlug | null,
): Promise<boolean> {
  if (!providerSlug) return false;
  const resolve = createDefaultCredentialResolver(store);
  const credential = await resolve(organizationId, providerSlug);
  return credential !== null;
}
