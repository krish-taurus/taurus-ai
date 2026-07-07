import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import { saveProviderCredential, updateEmployeeBrain } from "@/modules/model-gateway/service";
import {
  listConfiguredProviderSlugs,
  isProviderConfigured,
} from "@/modules/model-gateway/credential-resolver";
import { resolveModelForTask } from "@/modules/model-gateway/router";
import { modelsByProvider } from "@/modules/model-gateway/catalog";
import { computeChatReadiness } from "@/modules/employee-chat/readiness";
import type { AiEmployee, OrganizationModelSettings, ProviderSlug } from "@/lib/db/types";

const MASTER_KEY_VAR = "TAURUS_MODEL_CREDENTIALS_MASTER_KEY";
const ENV_KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "DEEPSEEK_API_KEY",
  "MOONSHOT_API_KEY",
  "GROQ_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "FIREWORKS_API_KEY",
];
const actor = { organizationId: "org-1", userId: "11111111-1111-1111-1111-111111111111" };

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env[MASTER_KEY_VAR];
  for (const k of ENV_KEYS) delete process.env[k];
});

function withEncryption() {
  process.env[MASTER_KEY_VAR] = "unit-test-master-key-1234567890";
}

async function seedEmployee(store: InMemoryStore, name = "Nova"): Promise<AiEmployee> {
  return store.createEmployee({
    organizationId: "org-1",
    name,
    roleTitle: "Support",
    department: "Support",
    description: null,
    status: "active",
    createdBy: null,
  });
}

async function publishDna(store: InMemoryStore, employeeId: string) {
  const dna: EmployeeDnaV1 = {
    ...createEmptyDnaV1(),
    identity: { mission: "Help.", roleSummary: "Support", primaryGoals: [], successCriteria: [] },
  };
  await store.saveEmployeeDnaDraft({
    organizationId: "org-1",
    employeeId,
    dna,
    userId: actor.userId,
  });
  await store.publishEmployeeDna({ organizationId: "org-1", employeeId, userId: actor.userId });
}

function orgSettings(patch: Partial<OrganizationModelSettings> = {}): OrganizationModelSettings {
  return {
    id: "s1",
    organizationId: "org-1",
    defaultModelId: null,
    routingMode: "auto_balanced",
    allowedProviderSlugs: [],
    blockedProviderSlugs: [],
    monthlyBudgetUsd: null,
    budgetAlertThresholdPercent: null,
    fallbackModelId: null,
    updatedByUserId: null,
    createdAt: "x",
    updatedAt: "x",
    ...patch,
  };
}

// --- Configured-provider detection (no slug ever hits a UUID field) ---------

describe("configured provider detection", () => {
  it("treats an active BYOK credential as configured (by slug), without env keys", async () => {
    withEncryption();
    const store = new InMemoryStore();
    await saveProviderCredential(store, actor, {
      providerSlug: "anthropic",
      apiKey: "sk-anthropic-secret-4242",
    });

    expect(await isProviderConfigured(store, "org-1", "anthropic")).toBe(true);
    expect(await isProviderConfigured(store, "org-1", "openai")).toBe(false);
    const configured = await listConfiguredProviderSlugs(store, "org-1");
    expect(configured).toEqual(["anthropic"]);
    // The credential + configured set never leak key material.
    expect(JSON.stringify(configured)).not.toContain("sk-anthropic-secret-4242");
  });

  it("treats a Taurus-managed env key as configured, without requiring BYOK", async () => {
    const store = new InMemoryStore();
    vi.stubEnv("OPENAI_API_KEY", "sk-env-openai");
    expect(await isProviderConfigured(store, "org-1", "openai")).toBe(true);
    expect(await listConfiguredProviderSlugs(store, "org-1")).toContain("openai");
  });
});

// --- Chat readiness recognizes BYOK end to end ------------------------------

describe("chat readiness recognizes configured providers", () => {
  for (const slug of ["openai", "anthropic"] as ProviderSlug[]) {
    it(`passes in production with an active ${slug} BYOK key (auto-routes to the configured provider)`, async () => {
      withEncryption();
      const store = new InMemoryStore();
      const emp = await seedEmployee(store);
      await publishDna(store, emp.id);
      await saveProviderCredential(store, actor, {
        providerSlug: slug,
        apiKey: `sk-${slug}-secret-4242`,
      });

      const readiness = await computeChatReadiness(
        store,
        { organizationId: "org-1", employee: emp },
        { isProduction: () => true }, // no demo fallback — real gating
      );

      expect(readiness.canChat).toBe(true);
      expect(readiness.brainMode).toBe("live");
      expect(readiness.blockReason).toBeNull();
      expect(readiness.liveProviderAvailable).toBe(true);
    });
  }

  it("passes when the employee override model matches a configured provider", async () => {
    withEncryption();
    const store = new InMemoryStore();
    const emp = await seedEmployee(store);
    await publishDna(store, emp.id);
    await saveProviderCredential(store, actor, { providerSlug: "anthropic", apiKey: "sk-a-4242" });

    const anthropicModel = modelsByProvider("anthropic")[0].modelId;
    await store.updateEmployeeModelSettings("org-1", emp.id, {
      modelId: anthropicModel,
      routingMode: "manual",
    });

    const readiness = await computeChatReadiness(
      store,
      { organizationId: "org-1", employee: emp },
      { isProduction: () => true },
    );
    expect(readiness.canChat).toBe(true);
    expect(readiness.brainMode).toBe("live");
  });

  it("passes with a Taurus-managed env key (no BYOK required)", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store);
    await publishDna(store, emp.id);
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-env-anthropic");

    const readiness = await computeChatReadiness(
      store,
      { organizationId: "org-1", employee: emp },
      { isProduction: () => true },
    );
    expect(readiness.canChat).toBe(true);
    expect(readiness.brainMode).toBe("live");
  });

  it("blocks with 'Connect a model provider' when no provider key exists (production)", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store);
    await publishDna(store, emp.id);

    const readiness = await computeChatReadiness(
      store,
      { organizationId: "org-1", employee: emp },
      { isProduction: () => true },
    );
    expect(readiness.canChat).toBe(false);
    expect(readiness.blockReason).toBe("needs_model_hub");
  });

  it("blocks with 'Choose a default Employee Brain' when a provider key exists but no model resolves", async () => {
    withEncryption();
    const store = new InMemoryStore();
    const emp = await seedEmployee(store);
    await publishDna(store, emp.id);
    await saveProviderCredential(store, actor, { providerSlug: "anthropic", apiKey: "sk-a-4242" });

    const readiness = await computeChatReadiness(
      store,
      { organizationId: "org-1", employee: emp },
      {
        isProduction: () => true,
        // A provider is configured, but nothing resolves to a model.
        resolveProviderSlug: async () => ({ providerSlug: null, modelLabel: null }),
        listConfiguredProviders: async () => ["anthropic"],
      },
    );
    expect(readiness.canChat).toBe(false);
    expect(readiness.blockReason).toBe("no_model");
  });
});

// --- Employee override vs organization default ------------------------------

describe("model resolution precedence", () => {
  it("uses the employee override over the organization default", () => {
    const openai = modelsByProvider("openai")[0].modelId;
    const anthropic = modelsByProvider("anthropic")[0].modelId;
    const resolved = resolveModelForTask({
      orgSettings: orgSettings({ routingMode: "manual", defaultModelId: openai }),
      employeeSettings: {
        id: "e1",
        organizationId: "org-1",
        employeeId: "emp-1",
        modelId: anthropic,
        routingMode: null,
        maxMonthlyBudgetUsd: null,
        fallbackModelId: null,
        updatedByUserId: null,
        createdAt: "x",
        updatedAt: "x",
      },
    });
    expect(resolved.model?.modelId).toBe(anthropic);
  });

  it("uses the organization default when the employee inherits", () => {
    const openai = modelsByProvider("openai")[0].modelId;
    const resolved = resolveModelForTask({
      orgSettings: orgSettings({ routingMode: "manual", defaultModelId: openai }),
      employeeSettings: null,
    });
    expect(resolved.model?.modelId).toBe(openai);
  });

  it("restricts automatic routing to providers with a usable credential", () => {
    // Only Anthropic is configured → balanced auto-routing must pick Anthropic.
    const resolved = resolveModelForTask({
      orgSettings: orgSettings({ routingMode: "auto_balanced" }),
      availableProviderSlugs: ["anthropic"],
    });
    expect(resolved.model?.providerSlug).toBe("anthropic");
  });
});

// --- Employee Brain persistence ---------------------------------------------

describe("Employee Brain save persistence", () => {
  it("persists economy, balanced, and premium as routing modes (no exact model)", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store);

    for (const [selection, routingMode] of [
      ["economy", "cost_optimized"],
      ["balanced", "auto_balanced"],
      ["premium", "quality_first"],
    ] as const) {
      const updated = await updateEmployeeBrain(store, actor, emp.id, { selection });
      expect(updated.routingMode).toBe(routingMode);
      expect(updated.modelId).toBeNull();
      const reloaded = await store.getEmployeeModelSettings("org-1", emp.id);
      expect(reloaded?.routingMode).toBe(routingMode);
    }
  });

  it("persists an advanced exact model, then clears the override on inherit", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store);
    const model = modelsByProvider("anthropic")[0].modelId;

    const advanced = await updateEmployeeBrain(store, actor, emp.id, {
      selection: "advanced",
      modelId: model,
    });
    expect(advanced.modelId).toBe(model);
    expect(advanced.routingMode).toBe("manual");

    const inherited = await updateEmployeeBrain(store, actor, emp.id, { selection: "inherit" });
    expect(inherited.modelId).toBeNull();
    expect(inherited.routingMode).toBeNull();
  });
});
