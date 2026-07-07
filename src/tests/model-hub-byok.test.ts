import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import {
  saveProviderCredential,
  testProviderConnection,
  type ProviderProbeInput,
} from "@/modules/model-gateway/service";
import { createDefaultCredentialResolver } from "@/modules/model-gateway/credential-resolver";

const MASTER_KEY_VAR = "TAURUS_MODEL_CREDENTIALS_MASTER_KEY";
const actor = { organizationId: "org-1", userId: "user-1" };

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env[MASTER_KEY_VAR];
});

function withEncryption() {
  process.env[MASTER_KEY_VAR] = "unit-test-master-key-1234567890";
}

// --- Base URL + label (Sprint 013) -----------------------------------------

describe("BYOK base URL + label", () => {
  it("stores an optional label and returns it in metadata (never the key)", async () => {
    withEncryption();
    const store = new InMemoryStore();
    const meta = await saveProviderCredential(store, actor, {
      providerSlug: "openai",
      apiKey: "sk-plaintext-value-4242",
      label: "Finance team key",
    });
    expect(meta.label).toBe("Finance team key");
    expect(meta.keyLastFour).toBe("4242");
    expect(JSON.stringify(meta)).not.toContain("sk-plaintext-value-4242");
  });

  it("requires a base URL for the custom OpenAI-compatible provider", async () => {
    withEncryption();
    const store = new InMemoryStore();
    await expect(
      saveProviderCredential(store, actor, {
        providerSlug: "custom_openai_compatible",
        apiKey: "sk-custom-key-1234",
      }),
    ).rejects.toThrow(/base url/i);
  });

  it("saves the custom provider with a base URL and resolves using it at runtime", async () => {
    withEncryption();
    const store = new InMemoryStore();
    const meta = await saveProviderCredential(store, actor, {
      providerSlug: "custom_openai_compatible",
      apiKey: "sk-custom-key-1234",
      baseUrl: "https://api.example.com/v1",
      label: "Self-hosted",
    });
    expect(meta.baseUrl).toBe("https://api.example.com/v1");

    const resolve = createDefaultCredentialResolver(store);
    const cred = await resolve("org-1", "custom_openai_compatible");
    expect(cred?.mode).toBe("bring_your_own_key");
    expect(cred?.baseUrl).toBe("https://api.example.com/v1");
  });

  it("ignores a base URL for providers that already have a default endpoint", async () => {
    withEncryption();
    const store = new InMemoryStore();
    const meta = await saveProviderCredential(store, actor, {
      providerSlug: "openai",
      apiKey: "sk-openai-key-1234",
      baseUrl: "https://sneaky.example.com/v1",
    });
    expect(meta.baseUrl).toBeNull();
  });

  it("keeps the base URL and label out of audit key material", async () => {
    withEncryption();
    const store = new InMemoryStore();
    await saveProviderCredential(store, actor, {
      providerSlug: "custom_openai_compatible",
      apiKey: "sk-super-secret-9999",
      baseUrl: "https://api.example.com/v1",
      label: "Ops",
    });
    const audits = JSON.stringify(store._auditEvents());
    expect(audits).not.toContain("sk-super-secret-9999");
    expect(audits).toContain("provider_credential.saved");
  });
});

// --- Test connection (Sprint 013) ------------------------------------------

describe("testProviderConnection", () => {
  it("reports success via the injected probe and never calls the network", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-env-managed-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const store = new InMemoryStore();

    const seen: ProviderProbeInput[] = [];
    const result = await testProviderConnection(store, actor, "openai", {
      probe: async (input) => {
        seen.push(input);
      },
    });

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/successful/i);
    expect(fetchSpy).not.toHaveBeenCalled();
    // The probe received a usable credential + model.
    expect(seen[0].apiKey).toBe("sk-env-managed-key");
    expect(seen[0].modelId).toBeTruthy();

    // Metadata-only audit — no key material, no message content.
    const audits = store._auditEvents();
    const tested = audits.find((e) => e.action === "provider_credential.tested");
    expect(tested).toBeTruthy();
    expect(JSON.stringify(tested)).not.toContain("sk-env-managed-key");
    fetchSpy.mockRestore();
  });

  it("reports a friendly failure when the probe throws, without leaking the error", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-env-managed-key");
    const store = new InMemoryStore();
    const result = await testProviderConnection(store, actor, "openai", {
      probe: async () => {
        throw new Error("401 Unauthorized at https://api.openai.com/v1 with key sk-leak");
      },
    });
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain("sk-leak");
    expect(result.message).toMatch(/failed/i);
  });

  it("does not run the probe when no credential is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    const store = new InMemoryStore();
    let probed = false;
    const result = await testProviderConnection(store, actor, "openai", {
      probe: async () => {
        probed = true;
      },
    });
    expect(probed).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no usable key/i);
  });
});
