import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { saveProviderCredential } from "@/modules/model-gateway/service";
import { PROVIDER_SLUGS } from "@/modules/model-gateway/schema";
import type { ProviderSlug } from "@/lib/db/types";

/**
 * Regression coverage for the BYOK save bug: provider credentials + their audit
 * events are keyed by provider SLUG ("openai", "anthropic", …), never a UUID.
 * The audit_events.target_id column was uuid, so saving raised
 *   invalid input syntax for type uuid: "openai"
 * Migration 0013 widens target_id to text.
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

describe("BYOK save by provider slug (hotfix)", () => {
  it("saves an OpenAI key by slug — no UUID coercion, encrypted, slug-keyed", async () => {
    withEncryption();
    const store = new InMemoryStore();

    const meta = await saveProviderCredential(store, actor, inputFor("openai"));

    // Keyed by the provider SLUG, not a UUID.
    expect(meta.providerSlug).toBe("openai");
    expect(meta.credentialMode).toBe("bring_your_own_key");
    expect(meta.status).toBe("active");
    expect(meta.keyLastFour).toBe("4242");

    // Metadata loads by slug and shows "configured".
    const loaded = await store.getProviderCredentialMetadata("org-1", "openai");
    expect(loaded?.credentialMode).toBe("bring_your_own_key");
    expect(loaded?.status).toBe("active");

    // Encrypted at rest; plaintext never stored or returned.
    const encrypted = await store.getProviderEncryptedKey("org-1", "openai");
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toContain("sk-openai-plaintext-4242");
    expect(JSON.stringify(meta)).not.toContain("sk-openai-plaintext-4242");
    expect((meta as unknown as Record<string, unknown>).encryptedApiKey).toBeUndefined();

    // The audit event targets the slug (not a UUID) and never carries the key.
    const audit = store._auditEvents().find((e) => e.action === "provider_credential.saved");
    expect(audit?.targetId).toBe("openai");
    expect(JSON.stringify(store._auditEvents())).not.toContain("sk-openai-plaintext-4242");
  });

  it("saves an Anthropic key by slug", async () => {
    withEncryption();
    const store = new InMemoryStore();
    const meta = await saveProviderCredential(store, actor, inputFor("anthropic"));
    expect(meta.providerSlug).toBe("anthropic");
    expect(meta.status).toBe("active");
    const audit = store._auditEvents().find((e) => e.action === "provider_credential.saved");
    expect(audit?.targetId).toBe("anthropic");
  });

  it("saves a key for every supported provider without UUID errors", async () => {
    withEncryption();
    for (const slug of PROVIDER_SLUGS) {
      const store = new InMemoryStore();
      const meta = await saveProviderCredential(store, actor, inputFor(slug));
      expect(meta.providerSlug, `provider ${slug}`).toBe(slug);
      expect(meta.status).toBe("active");
      expect(meta.keyLastFour).toBe("4242");
      // The audit target id is the slug string — a value a uuid column rejects.
      const audit = store._auditEvents().find((e) => e.action === "provider_credential.saved");
      expect(audit?.targetId).toBe(slug);
      expect(typeof audit?.targetId).toBe("string");
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
  it("stores target_id as text so provider slugs are valid", () => {
    const dir = join(process.cwd(), "db", "migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n")
      .toLowerCase();

    // The hotfix migration widens the column to text.
    expect(sql).toMatch(/alter column target_id type text/);
  });
});
