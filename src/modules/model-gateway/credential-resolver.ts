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
import { getProvider } from "@/modules/model-gateway/catalog";
import { decryptApiKey, isEncryptionConfigured } from "@/modules/model-gateway/credentials";
import { DEFAULT_PROVIDERS } from "@/modules/model-gateway/providers";
import { LlmGateway } from "@/modules/model-gateway/gateway";

/** Whether a provider has a Taurus-managed key available via env. */
export function isPlatformKeyAvailable(providerSlug: ProviderSlug): boolean {
  const provider = getProvider(providerSlug);
  if (!provider?.platformKeyEnvVar) return false;
  const value = process.env[provider.platformKeyEnvVar];
  return typeof value === "string" && value.trim().length > 0;
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
        return { apiKey, baseUrl: provider.defaultBaseUrl, mode: "bring_your_own_key" };
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

/** Build the default, production LLM gateway backed by real provider adapters. */
export function createLlmGateway(store: DataStore): LlmGateway {
  return new LlmGateway({
    store,
    providers: DEFAULT_PROVIDERS,
    resolveCredential: createDefaultCredentialResolver(store),
  });
}
