import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import {
  disableProviderCredential,
  saveProviderCredential,
  testProviderConnection,
} from "@/modules/model-gateway/service";
import { PROVIDER_SLUGS } from "@/modules/model-gateway/schema";
import type { ProviderSlug } from "@/lib/db/types";

/**
 * Regression coverage for the BYOK slug/UUID bug: provider credentials are keyed
 * by provider SLUG ("openai", "anthropic", …), never a UUID. Every credential
 * store query uses organization_id + provider_slug, and the credential audit
 * events carry the slug in metadata while leaving the uuid target_id column null
 * — so no operation (save / metadata / test / remove) can push a slug into a
 * uuid column. Migration 0013 additionally widens target_id to text as defense
 * in depth.
 */

const MASTER_KEY_VAR = "TAURUS_MODEL_CREDENTIALS_MASTER_KEY";
const actor = { organizationId: "org-1", userId: "11111111-1111-1111-1111-111111111111" };

afterEach(() => {
  delete process.env[MASTER_KEY_VAR];
});

function withEncryption() {
  process.env[MASTER_KEY_VAR] = "unit-test-master-key-1234567890";
}

/** The custom provider needs a base URL; the rest have a default endpoint. */
function inputFor(slug: ProviderSlug) {
  return slug === "custom_openai_compatible"
    ? {
        providerSlug: slug,
        apiKey: `sk-${slug}-plaintext-4242`,
        baseUrl: "https://api.example.com/v1",
      }
    : { providerSlug: slug, apiKey: `sk-${slug}-plaintext-4242` };
}

/** No audit event ever uses a provider slug as its (uuid) target_id. */
function assertNoSlugTargetIds(store: InMemoryStore) {
  const slugs = new Set<string>(PROVIDER_SLUGS);
  for (const event of store._auditEvents()) {
    if (event.targetId != null) {
      expect(
        slugs.has(event.targetId),
        `target_id must not be a provider slug: ${event.targetId}`,
      ).toBe(false);
    }
  }
}

describe("BYOK credential audit keying (hotfix)", () => {
  it("records the provider by slug in metadata, never in the uuid target_id", async () => {
    withEncryption();
    const store = new InMemoryStore();
    await saveProviderCredential(store, actor, inputFor("openai"));

    const audit = store._auditEvents().find((e) => e.action === "provider_credential.saved");
    expect(audit?.targetType).toBe("provider");
    expect(audit?.targetId).toBeNull();
    expect(audit?.metadata?.providerSlug).toBe("openai");
    assertNoSlugTargetIds(store);
  });
});

describe("OpenAI + Anthropic full BYOK lifecycle", () => {
  for (const slug of ["openai", "anthropic"] as ProviderSlug[]) {
    it(`saves, reloads metadata, tests, and removes a ${slug} key without UUID errors`, async () => {
      withEncryption();
      const store = new InMemoryStore();

      // 1. Save.
      const meta = await saveProviderCredential(store, actor, inputFor(slug));
      expect(meta.providerSlug).toBe(slug);
      expect(meta.credentialMode).toBe("bring_your_own_key");
      expect(meta.status).toBe("active");
      expect(meta.keyLastFour).toBe("4242");
      expect(JSON.stringify(meta)).not.toContain(`sk-${slug}-plaintext-4242`);
      expect((meta as unknown as Record<string, unknown>).encryptedApiKey).toBeUndefined();

      // 2. Metadata reload (queried by org + provider_slug).
      const loaded = await store.getProviderCredentialMetadata("org-1", slug);
      expect(loaded?.providerSlug).toBe(slug);
      expect(loaded?.status).toBe("active");
      const encrypted = await store.getProviderEncryptedKey("org-1", slug);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toContain(`sk-${slug}-plaintext-4242`);

      // 3. Test connection (injected probe — no network). Must not throw.
      let probedKey: string | null = null;
      const result = await testProviderConnection(store, actor, slug, {
        probe: async (input) => {
          probedKey = input.apiKey;
        },
      });
      expect(result.ok).toBe(true);
      expect(probedKey).toBe(`sk-${slug}-plaintext-4242`); // resolver decrypted the saved key
      const tested = store._auditEvents().find((e) => e.action === "provider_credential.tested");
      expect(tested?.metadata?.providerSlug).toBe(slug);

      // 4. Remove / disable.
      await disableProviderCredential(store, actor, slug);
      const afterRemove = await store.getProviderCredentialMetadata("org-1", slug);
      expect(afterRemove?.credentialMode).toBe("disabled");
      expect(afterRemove?.status).toBe("disabled");
      expect(afterRemove?.keyLastFour).toBeNull();
      const disabled = store
        ._auditEvents()
        .find((e) => e.action === "provider_credential.disabled");
      expect(disabled?.metadata?.providerSlug).toBe(slug);

      // No step leaked a slug into a uuid target_id, and no plaintext was stored.
      assertNoSlugTargetIds(store);
      expect(JSON.stringify(store._auditEvents())).not.toContain(`sk-${slug}-plaintext-4242`);
    });
  }
});

describe("BYOK save by provider slug", () => {
  it("saves a key for every supported provider without UUID errors", async () => {
    withEncryption();
    for (const slug of PROVIDER_SLUGS) {
      const store = new InMemoryStore();
      const meta = await saveProviderCredential(store, actor, inputFor(slug));
      expect(meta.providerSlug, `provider ${slug}`).toBe(slug);
      expect(meta.status).toBe("active");
      expect(meta.keyLastFour).toBe("4242");
      const audit = store._auditEvents().find((e) => e.action === "provider_credential.saved");
      expect(audit?.metadata?.providerSlug).toBe(slug);
      expect(audit?.targetId).toBeNull();
      assertNoSlugTargetIds(store);
    }
    // Exactly the eight required providers are covered.
    expect(PROVIDER_SLUGS).toEqual([
      "openai",
      "anthropic",
      "deepseek",
      "moonshot_kimi",
      "groq",
      "google_gemini",
      "fireworks",
      "custom_openai_compatible",
    ]);
  });
});

describe("audit_events schema guard", () => {
  it("stores target_id as text so slug-shaped target ids are always valid (defense in depth)", () => {
    const dir = join(process.cwd(), "db", "migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n")
      .toLowerCase();
    expect(sql).toMatch(/alter column target_id type text/);
  });
});
