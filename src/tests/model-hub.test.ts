import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { AI_MODELS, MODEL_PROVIDERS, getModel } from "@/modules/model-gateway/catalog";
import { estimateCost } from "@/modules/model-gateway/pricing";
import {
  eligibleModels,
  providerAllowed,
  resolveModelForTask,
  validateModelSupportsTask,
} from "@/modules/model-gateway/router";
import {
  decryptApiKey,
  encryptApiKey,
  isEncryptionConfigured,
  lastFour,
} from "@/modules/model-gateway/credentials";
import { LlmGateway } from "@/modules/model-gateway/gateway";
import {
  createDefaultCredentialResolver,
  isPlatformKeyAvailable,
} from "@/modules/model-gateway/credential-resolver";
import { saveProviderCredential, updateEmployeeBrain } from "@/modules/model-gateway/service";
import type { LLMProvider } from "@/modules/model-gateway/types";
import type { OrganizationModelSettings, ProviderSlug } from "@/lib/db/types";
import { hasPermission, ROLES } from "@/modules/organizations/roles";

const MASTER_KEY_VAR = "TAURUS_MODEL_CREDENTIALS_MASTER_KEY";

function baseOrgSettings(
  patch: Partial<OrganizationModelSettings> = {},
): OrganizationModelSettings {
  return {
    id: "settings-1",
    organizationId: "org-1",
    defaultModelId: null,
    routingMode: "auto_balanced",
    allowedProviderSlugs: [],
    blockedProviderSlugs: [],
    monthlyBudgetUsd: null,
    budgetAlertThresholdPercent: null,
    fallbackModelId: null,
    updatedByUserId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  };
}

/** A fake provider registry that records calls and never touches the network. */
function fakeRegistry(calls: unknown[]): Record<ProviderSlug, LLMProvider> {
  const slugs = MODEL_PROVIDERS.map((p) => p.slug);
  const make = (slug: ProviderSlug): LLMProvider => ({
    slug,
    async generateText(input) {
      calls.push(input);
      return {
        text: "generated reply",
        inputTokens: 100,
        cachedInputTokens: 0,
        outputTokens: 50,
        rawProviderRequestId: "req_fake_1",
        finishReason: "stop",
      };
    },
  });
  return Object.fromEntries(slugs.map((s) => [s, make(s)])) as Record<ProviderSlug, LLMProvider>;
}

describe("Model catalog", () => {
  it("includes all eight providers", () => {
    const slugs = MODEL_PROVIDERS.map((p) => p.slug).sort();
    expect(slugs).toEqual(
      [
        "anthropic",
        "custom_openai_compatible",
        "deepseek",
        "fireworks",
        "google_gemini",
        "groq",
        "moonshot_kimi",
        "openai",
      ].sort(),
    );
  });

  it("includes the required seed models", () => {
    const required = [
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-realtime-2",
      "claude-fable-5",
      "claude-opus-4-8",
      "claude-sonnet-5",
      "claude-haiku-4-5",
      "deepseek-v4-flash",
      "deepseek-v4-pro",
      "kimi-k2.6",
      "kimi-k2.7-code",
      "kimi-k2.7-code-highspeed",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro-preview",
    ];
    for (const id of required) {
      expect(getModel(id), `missing model ${id}`).toBeTruthy();
    }
  });

  it("has globally-unique model ids", () => {
    const ids = AI_MODELS.map((m) => m.modelId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries dated, sourced pricing on priced models", () => {
    for (const m of AI_MODELS) {
      if (m.inputUsdPerMillionTokens != null) {
        expect(m.priceCheckedAt).toBeTruthy();
        expect(m.pricingSourceUrl).toBeTruthy();
      }
    }
  });
});

describe("Cost estimator", () => {
  it("computes input + cached + output cost deterministically", () => {
    const model = getModel("gpt-5.4")!; // input 2.5, cached 0.25, output 10 per 1M
    const cost = estimateCost(model, {
      inputTokens: 1_000_000,
      cachedInputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost.status).toBe("known");
    expect(cost.inputUsd).toBeCloseTo(2.5, 6);
    expect(cost.cachedInputUsd).toBeCloseTo(0.25, 6);
    expect(cost.outputUsd).toBeCloseTo(10, 6);
    expect(cost.totalUsd).toBeCloseTo(12.75, 6);
  });

  it("scales linearly with token counts", () => {
    const model = getModel("claude-haiku-4-5")!; // input 1, output 5
    const cost = estimateCost(model, {
      inputTokens: 10_000,
      cachedInputTokens: 0,
      outputTokens: 2_000,
    });
    // 10k/1M*1 + 2k/1M*5 = 0.01 + 0.01 = 0.02
    expect(cost.totalUsd).toBeCloseTo(0.02, 6);
  });

  it("returns an unknown state when the model has no price", () => {
    const noPrice = {
      ...getModel("gpt-5.4")!,
      inputUsdPerMillionTokens: null,
      outputUsdPerMillionTokens: null,
    };
    const cost = estimateCost(noPrice, {
      inputTokens: 100,
      cachedInputTokens: 0,
      outputTokens: 100,
    });
    expect(cost.status).toBe("unknown");
    expect(cost.totalUsd).toBeNull();
  });
});

describe("Routing mode resolution", () => {
  it("cost_optimized picks an economy-tier model", () => {
    const r = resolveModelForTask({
      orgSettings: baseOrgSettings({ routingMode: "cost_optimized" }),
    });
    expect(r.model?.modelTier).toBe("economy");
  });

  it("quality_first picks a premium-tier model", () => {
    const r = resolveModelForTask({
      orgSettings: baseOrgSettings({ routingMode: "quality_first" }),
    });
    expect(r.model?.modelTier).toBe("premium");
  });

  it("privacy_first picks an open-weight model", () => {
    const r = resolveModelForTask({
      orgSettings: baseOrgSettings({ routingMode: "privacy_first" }),
    });
    expect(r.model?.modelTier).toBe("private_open");
  });

  it("manual mode uses the organization default model", () => {
    const r = resolveModelForTask({
      orgSettings: baseOrgSettings({ routingMode: "manual", defaultModelId: "claude-opus-4-8" }),
    });
    expect(r.model?.modelId).toBe("claude-opus-4-8");
  });

  it("honors an employee exact-model override", () => {
    const r = resolveModelForTask({
      orgSettings: baseOrgSettings(),
      employeeSettings: {
        id: "e1",
        organizationId: "org-1",
        employeeId: "emp-1",
        modelId: "gemini-3.1-pro-preview",
        routingMode: null,
        maxMonthlyBudgetUsd: null,
        fallbackModelId: null,
        updatedByUserId: null,
        createdAt: "x",
        updatedAt: "x",
      },
    });
    expect(r.model?.modelId).toBe("gemini-3.1-pro-preview");
  });

  it("filters by required capabilities", () => {
    const r = resolveModelForTask({
      orgSettings: baseOrgSettings({ routingMode: "privacy_first" }),
      requiredCapabilities: ["vision"],
    });
    // Open-weight models here have no vision, so it must fall through to one that does.
    expect(r.model?.supportsVision).toBe(true);
  });

  it("validateModelSupportsTask rejects unmet capabilities", () => {
    const res = validateModelSupportsTask("llama-3.1-8b-instant", ["vision"]);
    expect(res.ok).toBe(false);
  });
});

describe("Provider allow/block lists", () => {
  it("empty allowlist permits any non-blocked provider", () => {
    expect(providerAllowed("openai", [], [])).toBe(true);
    expect(providerAllowed("openai", [], ["openai"])).toBe(false);
  });

  it("non-empty allowlist permits only listed providers", () => {
    expect(providerAllowed("anthropic", ["anthropic"], [])).toBe(true);
    expect(providerAllowed("openai", ["anthropic"], [])).toBe(false);
  });

  it("eligibleModels only returns allowed providers", () => {
    const models = eligibleModels({
      orgSettings: baseOrgSettings({ allowedProviderSlugs: ["anthropic"] }),
    });
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.providerSlug === "anthropic")).toBe(true);
  });

  it("routing respects the allowlist", () => {
    const r = resolveModelForTask({
      orgSettings: baseOrgSettings({
        routingMode: "quality_first",
        allowedProviderSlugs: ["deepseek"],
      }),
    });
    expect(r.model?.providerSlug).toBe("deepseek");
  });
});

describe("Organization isolation", () => {
  it("keeps model settings, credentials, and usage per-organization", async () => {
    const store = new InMemoryStore();

    await store.updateOrganizationModelSettings("org-a", { routingMode: "quality_first" });
    const aSettings = await store.getOrganizationModelSettings("org-a");
    const bSettings = await store.getOrganizationModelSettings("org-b");
    expect(aSettings.routingMode).toBe("quality_first");
    expect(bSettings.routingMode).toBe("auto_balanced"); // default, untouched

    await store.saveProviderCredential({
      organizationId: "org-a",
      providerSlug: "openai",
      credentialMode: "bring_your_own_key",
      encryptedApiKey: "enc",
      keyLastFour: "1234",
    });
    expect(await store.getProviderCredentialMetadata("org-a", "openai")).toBeTruthy();
    expect(await store.getProviderCredentialMetadata("org-b", "openai")).toBeNull();

    await store.createLlmUsageEvent({
      organizationId: "org-a",
      providerSlug: "openai",
      modelId: "gpt-5.4",
      taskType: "system_test",
      inputTokens: 1,
      outputTokens: 1,
      status: "success",
    });
    expect(await store.listLlmUsageEvents("org-a")).toHaveLength(1);
    expect(await store.listLlmUsageEvents("org-b")).toHaveLength(0);
  });

  it("does not leak an employee's model settings across organizations", async () => {
    const store = new InMemoryStore();
    store._seedEmployee("emp-1", "org-a");
    await store.updateEmployeeModelSettings("org-a", "emp-1", { modelId: "gpt-5.4" });
    expect(await store.getEmployeeModelSettings("org-a", "emp-1")).toBeTruthy();
    expect(await store.getEmployeeModelSettings("org-b", "emp-1")).toBeNull();
  });
});

describe("Permissions", () => {
  it("lets every role view the Model Hub", () => {
    for (const role of ROLES) {
      expect(hasPermission(role, "model_hub.view")).toBe(true);
    }
  });

  it("lets only owner/admin manage the Model Hub", () => {
    expect(hasPermission("owner", "model_hub.manage")).toBe(true);
    expect(hasPermission("admin", "model_hub.manage")).toBe(true);
    expect(hasPermission("builder", "model_hub.manage")).toBe(false);
    expect(hasPermission("viewer", "model_hub.manage")).toBe(false);
  });
});

describe("BYOK encryption", () => {
  afterEach(() => {
    delete process.env[MASTER_KEY_VAR];
  });

  it("is disabled when the master key is absent", () => {
    delete process.env[MASTER_KEY_VAR];
    expect(isEncryptionConfigured()).toBe(false);
  });

  it("encrypts and round-trips without exposing plaintext", async () => {
    process.env[MASTER_KEY_VAR] = "unit-test-master-key-1234567890";
    expect(isEncryptionConfigured()).toBe(true);

    const secret = "sk-super-secret-key-9999";
    const encrypted = await encryptApiKey(secret);
    expect(encrypted).not.toContain(secret);
    expect(await decryptApiKey(encrypted)).toBe(secret);
    expect(lastFour(secret)).toBe("9999");
  });

  it("service stores keys encrypted and never returns plaintext", async () => {
    process.env[MASTER_KEY_VAR] = "unit-test-master-key-1234567890";
    const store = new InMemoryStore();
    const actor = { organizationId: "org-1", userId: "user-1" };

    const meta = await saveProviderCredential(store, actor, {
      providerSlug: "openai",
      apiKey: "sk-plaintext-value-4242",
    });

    // Metadata exposes only the last four; no key material.
    expect(meta.keyLastFour).toBe("4242");
    expect(JSON.stringify(meta)).not.toContain("sk-plaintext-value-4242");
    expect((meta as unknown as Record<string, unknown>).encryptedApiKey).toBeUndefined();

    // The stored encrypted value is not the plaintext.
    const encrypted = await store.getProviderEncryptedKey("org-1", "openai");
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toContain("sk-plaintext-value-4242");

    // Audit events never contain the key.
    expect(JSON.stringify(store._auditEvents())).not.toContain("sk-plaintext-value-4242");
  });

  it("service refuses BYOK when encryption is not configured", async () => {
    delete process.env[MASTER_KEY_VAR];
    const store = new InMemoryStore();
    await expect(
      saveProviderCredential(
        store,
        { organizationId: "org-1", userId: "u" },
        {
          providerSlug: "openai",
          apiKey: "sk-should-not-save",
        },
      ),
    ).rejects.toThrow();
  });
});

describe("LLM Gateway", () => {
  it("resolves a model, estimates cost, and records a metadata-only usage event", async () => {
    const store = new InMemoryStore();
    const calls: unknown[] = [];
    let clock = 0;
    const gateway = new LlmGateway({
      store,
      providers: fakeRegistry(calls),
      resolveCredential: async () => ({
        apiKey: "test-key",
        baseUrl: null,
        mode: "taurus_managed",
      }),
      now: () => (clock += 5),
    });

    const response = await gateway.generateText({
      organizationId: "org-1",
      taskType: "system_test",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "TOP-SECRET-MESSAGE-CONTENT" },
      ],
    });

    expect(calls).toHaveLength(1); // the fake provider was used
    expect(response.text).toBe("generated reply");
    expect(response.estimatedCostUsd).not.toBeNull();
    expect(response.latencyMs).toBeGreaterThanOrEqual(0);

    const events = await store.listLlmUsageEvents("org-1");
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("success");
    expect(events[0].inputTokens).toBe(100);
    expect(events[0].outputTokens).toBe(50);
    // Metadata only — message contents are never persisted.
    expect(JSON.stringify(events)).not.toContain("TOP-SECRET-MESSAGE-CONTENT");
    expect(JSON.stringify(events)).not.toContain("test-key");
  });

  it("throws when no provider credential is configured", async () => {
    const store = new InMemoryStore();
    const gateway = new LlmGateway({
      store,
      providers: fakeRegistry([]),
      resolveCredential: async () => null, // no credential available
    });
    await expect(
      gateway.generateText({ organizationId: "org-1", taskType: "system_test", messages: [] }),
    ).rejects.toThrow();
  });

  it("never calls global fetch during a gateway run", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const store = new InMemoryStore();
    const gateway = new LlmGateway({
      store,
      providers: fakeRegistry([]),
      resolveCredential: async () => ({ apiKey: "k", baseUrl: null, mode: "taurus_managed" }),
    });
    await gateway.generateText({
      organizationId: "org-1",
      taskType: "system_test",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("Local dev without provider keys", () => {
  const KEYS = [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "DEEPSEEK_API_KEY",
    "MOONSHOT_API_KEY",
    "GROQ_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "FIREWORKS_API_KEY",
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("reports no managed key and resolves to null without throwing", async () => {
    expect(isPlatformKeyAvailable("openai")).toBe(false);
    const store = new InMemoryStore();
    const resolve = createDefaultCredentialResolver(store);
    expect(await resolve("org-1", "openai")).toBeNull();
  });

  it("marks a provider available once its env key is set", async () => {
    process.env.OPENAI_API_KEY = "sk-env-test";
    expect(isPlatformKeyAvailable("openai")).toBe(true);
    const store = new InMemoryStore();
    const resolve = createDefaultCredentialResolver(store);
    const cred = await resolve("org-1", "openai");
    expect(cred?.mode).toBe("taurus_managed");
  });
});

describe("Employee Brain service", () => {
  it("maps a simple mode to a routing mode and audits metadata only", async () => {
    const store = new InMemoryStore();
    store._seedEmployee("emp-1", "org-1");
    const actor = { organizationId: "org-1", userId: "user-1" };

    const updated = await updateEmployeeBrain(store, actor, "emp-1", { selection: "premium" });
    expect(updated.routingMode).toBe("quality_first");
    expect(updated.modelId).toBeNull();

    const advanced = await updateEmployeeBrain(store, actor, "emp-1", {
      selection: "advanced",
      modelId: "claude-opus-4-8",
    });
    expect(advanced.modelId).toBe("claude-opus-4-8");
    expect(advanced.routingMode).toBe("manual");

    const inherited = await updateEmployeeBrain(store, actor, "emp-1", { selection: "inherit" });
    expect(inherited.modelId).toBeNull();
    expect(inherited.routingMode).toBeNull();

    const audits = store._auditEvents();
    expect(audits.some((e) => e.action === "employee_brain.updated")).toBe(true);
  });

  it("rejects an unknown employee across organizations", async () => {
    const store = new InMemoryStore();
    store._seedEmployee("emp-1", "org-1");
    await expect(
      updateEmployeeBrain(store, { organizationId: "org-2", userId: "u" }, "emp-1", {
        selection: "economy",
      }),
    ).rejects.toThrow();
  });
});

describe("Brain mode labels", () => {
  it("never uses forbidden UI terminology", () => {
    const serialized = JSON.stringify(AI_MODELS.map((m) => m.recommendedFor));
    expect(serialized.toLowerCase()).not.toContain("prompt");
    expect(serialized.toLowerCase()).not.toMatch(/\bagent/);
  });
});
