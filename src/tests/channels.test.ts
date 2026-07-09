import { afterEach, describe, expect, it } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { __resetStoreForTests } from "@/lib/db/store";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import { hasPermission, ROLES } from "@/modules/organizations/roles";
import { createWebChannel } from "@/modules/channels/service";
import {
  handlePublicChatMessage,
  resolveActiveChannel,
  PublicChannelError,
} from "@/modules/channels/runtime";
import { checkOrigin, normalizeDomain } from "@/modules/channels/domains";
import { checkChannelRateLimits, createRateLimiter } from "@/modules/channels/rate-limit";
import { rebuildKnowledgeRetrievalSegmentsForEmployee } from "@/modules/employee-chat/preparation";
import type { ChatGateway } from "@/modules/employee-chat/service";
import type { AiEmployee, ChannelAppearance } from "@/lib/db/types";
import type { GatewayRequest, GatewayResponse } from "@/modules/model-gateway/types";
import { POST } from "@/app/api/public/channels/[publicKey]/messages/route";

const actor = { organizationId: "org-1", userId: "user-1" };

const APPEARANCE: ChannelAppearance = {
  theme: "dark",
  position: "bottom-right",
  launcherLabel: "Chat",
  employeeDisplayName: "Nova",
  accentStyle: "mono",
  showSources: true,
  collectVisitorEmail: false,
  brandName: null,
};

async function seedEmployee(
  store: InMemoryStore,
  organizationId: string,
  overrides: Partial<AiEmployee> = {},
): Promise<AiEmployee> {
  return store.createEmployee({
    organizationId,
    name: overrides.name ?? "Nova",
    roleTitle: overrides.roleTitle ?? "Support Specialist",
    department: "Support",
    description: null,
    status: overrides.status ?? "active",
    createdBy: null,
  });
}

async function publishDna(store: InMemoryStore, organizationId: string, employeeId: string) {
  const dna: EmployeeDnaV1 = {
    ...createEmptyDnaV1(),
    identity: {
      mission: "Help customers.",
      roleSummary: "Support",
      primaryGoals: [],
      successCriteria: [],
    },
  };
  await store.saveEmployeeDnaDraft({ organizationId, employeeId, dna, userId: "user-1" });
  await store.publishEmployeeDna({ organizationId, employeeId, userId: "user-1" });
}

function fakeGateway(text = "Public reply."): { gateway: ChatGateway; calls: GatewayRequest[] } {
  const calls: GatewayRequest[] = [];
  const gateway: ChatGateway = {
    async resolveModelForTask() {
      return {
        model: {
          providerSlug: "openai",
          modelId: "gpt-5.4",
          displayName: "GPT-5.4",
          modelFamily: "gpt-5",
          status: "available",
          modelTier: "balanced",
          recommendedFor: "",
          contextWindowTokens: 400_000,
          maxOutputTokens: 128_000,
          supportsText: true,
          supportsVision: false,
          supportsAudio: false,
          supportsTools: false,
          supportsJson: false,
          supportsStreaming: false,
          supportsReasoning: false,
          supportsCaching: false,
          inputUsdPerMillionTokens: 1,
          cachedInputUsdPerMillionTokens: null,
          outputUsdPerMillionTokens: 2,
          pricingNotes: null,
          pricingSourceUrl: null,
          priceCheckedAt: null,
        },
        providerSlug: "openai",
        routingMode: "auto_balanced",
        reason: "test",
      };
    },
    async generateText(request): Promise<GatewayResponse> {
      calls.push(request);
      return {
        text,
        providerSlug: "openai",
        modelId: "gpt-5.4",
        inputTokens: 50,
        outputTokens: 10,
        estimatedCostUsd: 0.0001,
        latencyMs: 3,
        demo: false,
      };
    },
  };
  return { gateway, calls };
}

/** Seed an active web channel + published DNA for an active employee. */
async function seedActiveChannel(store: InMemoryStore) {
  const employee = await seedEmployee(store, "org-1");
  await publishDna(store, "org-1", employee.id);
  const channel = await createWebChannel(store, actor, employee, { name: "Website" });
  await store.activateEmployeeChannel("org-1", channel.id);
  const active = (await store.getEmployeeChannel("org-1", channel.id))!;
  return { employee, channel: active };
}

afterEach(() => {
  __resetStoreForTests(undefined);
});

// --- Channel management -----------------------------------------------------

describe("Channel management", () => {
  it("creates a web channel with an opaque public key and draft status", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    const channel = await createWebChannel(store, actor, employee, { name: "Website" });
    expect(channel.status).toBe("draft");
    expect(channel.channelProvider).toBe("taurus_web");
    expect(channel.publicKey.startsWith("tc_")).toBe(true);
    expect(channel.appearance.employeeDisplayName).toBe("Nova");
  });

  it("activates, pauses, and archives a channel", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    const channel = await createWebChannel(store, actor, employee, { name: "Website" });
    expect((await store.activateEmployeeChannel("org-1", channel.id))?.status).toBe("active");
    expect((await store.pauseEmployeeChannel("org-1", channel.id))?.status).toBe("paused");
    const archived = await store.archiveEmployeeChannel("org-1", channel.id);
    expect(archived?.status).toBe("archived");
    expect(archived?.archivedAt).toBeTruthy();
  });

  it("enforces public key uniqueness", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    const base = {
      organizationId: "org-1",
      employeeId: employee.id,
      channelType: "website_widget" as const,
      publicKey: "tc_dupe",
      name: "A",
      appearance: APPEARANCE,
    };
    await store.createEmployeeChannel(base);
    await expect(store.createEmployeeChannel({ ...base, name: "B" })).rejects.toThrow();
  });

  it("keeps channels organization-scoped for the dashboard", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    const channel = await createWebChannel(store, actor, employee, { name: "Website" });
    expect(await store.getEmployeeChannel("org-1", channel.id)).toBeTruthy();
    expect(await store.getEmployeeChannel("org-2", channel.id)).toBeNull();
  });
});

describe("Channel permissions", () => {
  it("grants manage to owner/admin/builder and view to everyone", () => {
    for (const role of ROLES) {
      expect(hasPermission(role, "channel.view")).toBe(true);
    }
    expect(hasPermission("owner", "channel.manage")).toBe(true);
    expect(hasPermission("admin", "channel.manage")).toBe(true);
    expect(hasPermission("builder", "channel.manage")).toBe(true);
    expect(hasPermission("viewer", "channel.manage")).toBe(false);
  });
});

// --- Public resolution + governance ----------------------------------------

describe("Public channel resolution", () => {
  it("resolves the organization from the public key (never the client)", async () => {
    const store = new InMemoryStore();
    const { channel } = await seedActiveChannel(store);
    const byKey = await store.getEmployeeChannelByPublicKey(channel.publicKey);
    expect(byKey?.organizationId).toBe("org-1");
    // Unknown key resolves to nothing.
    expect(await store.getEmployeeChannelByPublicKey("tc_nope")).toBeNull();
  });

  it("rejects an inactive (draft/paused) channel", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    await publishDna(store, "org-1", employee.id);
    const channel = await createWebChannel(store, actor, employee, { name: "Website" });
    await expect(resolveActiveChannel(store, channel.publicKey)).rejects.toMatchObject({
      code: "inactive",
    });
    await store.pauseEmployeeChannel("org-1", channel.id);
    await expect(resolveActiveChannel(store, channel.publicKey)).rejects.toMatchObject({
      code: "inactive",
    });
  });

  it("rejects an archived employee", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    await publishDna(store, "org-1", employee.id);
    const channel = await createWebChannel(store, actor, employee, { name: "Website" });
    await store.activateEmployeeChannel("org-1", channel.id);
    await store.updateEmployee("org-1", employee.id, { status: "archived" });
    await expect(resolveActiveChannel(store, channel.publicKey)).rejects.toMatchObject({
      code: "employee_unavailable",
    });
  });

  it("requires published Employee DNA", async () => {
    const store = new InMemoryStore();
    const employee = await seedEmployee(store, "org-1");
    const channel = await createWebChannel(store, actor, employee, { name: "Website" });
    await store.activateEmployeeChannel("org-1", channel.id);
    await expect(resolveActiveChannel(store, channel.publicKey)).rejects.toMatchObject({
      code: "needs_dna",
    });
  });
});

describe("Public chat runtime", () => {
  it("reuses the Employee Chat Runtime (calls the Model Gateway) and isolates sessions", async () => {
    const store = new InMemoryStore();
    const { channel } = await seedActiveChannel(store);
    const { gateway, calls } = fakeGateway("Hi there!");

    const result = await handlePublicChatMessage(
      { store, gateway },
      { publicKey: channel.publicKey, message: "Hello", originDomain: "acme.com" },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].taskType).toBe("employee_chat");
    expect(result.outbound.text).toBe("Hi there!");
    expect(result.employee.name).toBe("Nova");
    expect(result.sessionId).toBeTruthy();

    // A second message with the returned session id reuses the same session.
    const second = await handlePublicChatMessage(
      { store, gateway },
      { publicKey: channel.publicKey, message: "Again", sessionId: result.sessionId },
    );
    expect(second.sessionId).toBe(result.sessionId);
  });

  it("only surfaces assigned Knowledge Vault sources", async () => {
    const store = new InMemoryStore();
    const { employee, channel } = await seedActiveChannel(store);

    const vault = await store.createKnowledgeVault({ organizationId: "org-1", name: "Pricing" });
    const assigned = await store.createKnowledgeSource({
      organizationId: "org-1",
      vaultId: vault.id,
      name: "Pricing guide",
      description: null,
      sourceType: "text",
      visibility: "organization",
    });
    await store.updateKnowledgeSource("org-1", assigned.id, { status: "ready" });
    await store.createKnowledgeDocument({
      organizationId: "org-1",
      knowledgeSourceId: assigned.id,
      title: "Pricing guide",
      textContent: "Our pricing starts at 49 dollars per month.",
      extractionStatus: "extracted",
    });
    await store.assignVaultToEmployee({
      organizationId: "org-1",
      employeeId: employee.id,
      vaultId: vault.id,
    });

    // An unassigned source that should NEVER surface.
    const secret = await store.createKnowledgeSource({
      organizationId: "org-1",
      name: "Secret pricing",
      description: null,
      sourceType: "text",
      visibility: "organization",
    });
    await store.updateKnowledgeSource("org-1", secret.id, { status: "ready" });
    await store.createKnowledgeDocument({
      organizationId: "org-1",
      knowledgeSourceId: secret.id,
      title: "Secret pricing",
      textContent: "Secret pricing details.",
      extractionStatus: "extracted",
    });
    await rebuildKnowledgeRetrievalSegmentsForEmployee(store, "org-1", employee.id);

    const { gateway } = fakeGateway();
    const result = await handlePublicChatMessage(
      { store, gateway },
      { publicKey: channel.publicKey, message: "What is your pricing?" },
    );
    const names = result.outbound.sources.map((s) => s.name);
    expect(names).toContain("Pricing guide");
    expect(names).not.toContain("Secret pricing");
  });

  it("records metadata-only channel events (no message text)", async () => {
    const store = new InMemoryStore();
    const { employee, channel } = await seedActiveChannel(store);
    const { gateway } = fakeGateway();
    await handlePublicChatMessage(
      { store, gateway },
      { publicKey: channel.publicKey, message: "SECRET-PUBLIC-QUESTION-42" },
    );
    const events = await store.listPublicChannelEventsForEmployee("org-1", employee.id);
    expect(events.some((e) => e.eventType === "public_chat.message_sent")).toBe(true);
    expect(events.some((e) => e.eventType === "public_chat.response_generated")).toBe(true);
    expect(JSON.stringify(events)).not.toContain("SECRET-PUBLIC-QUESTION-42");
  });
});

// --- Origin + rate limiting -------------------------------------------------

describe("Origin allowlist", () => {
  it("allows localhost in development", () => {
    expect(checkOrigin("http://localhost:3000", [], { isDevelopment: true }).allowed).toBe(true);
  });

  it("rejects an unlisted domain but allows a listed one (and its subdomains)", () => {
    expect(checkOrigin("https://evil.com", ["acme.com"], { isDevelopment: false }).allowed).toBe(
      false,
    );
    expect(checkOrigin("https://acme.com", ["acme.com"], { isDevelopment: false }).allowed).toBe(
      true,
    );
    expect(
      checkOrigin("https://shop.acme.com", ["acme.com"], { isDevelopment: false }).allowed,
    ).toBe(true);
  });

  it("requires a configured domain for cross-origin use in production", () => {
    expect(checkOrigin("https://acme.com", [], { isDevelopment: false }).allowed).toBe(false);
  });

  it("normalizes domains", () => {
    expect(normalizeDomain("https://www.Acme.com/path")).toBe("acme.com");
  });
});

describe("Rate limiting", () => {
  it("blocks once the per-minute limit is exceeded", () => {
    const limiter = createRateLimiter();
    const input = { publicKey: "tc_x", sessionId: "s1", ipHash: null, perMinute: 2, perDay: 1000 };
    expect(checkChannelRateLimits(limiter, input).allowed).toBe(true);
    expect(checkChannelRateLimits(limiter, input).allowed).toBe(true);
    expect(checkChannelRateLimits(limiter, input).allowed).toBe(false);
  });
});

// --- Public API route (integration) ----------------------------------------

describe("Public message API", () => {
  it("returns a safe response and never exposes secrets or internal ids", async () => {
    const store = new InMemoryStore();
    __resetStoreForTests(store);
    const { channel } = await seedActiveChannel(store);

    const request = new Request(
      `http://localhost:3000/api/public/channels/${channel.publicKey}/messages`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "Hello there" }),
      },
    );
    const response = await POST(request, { params: { publicKey: channel.publicKey } });
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(typeof data.sessionId).toBe("string");
    expect(typeof data.message).toBe("string");
    expect(data.employee.name).toBe("Nova");
    expect(data.metadata.channelMode).toBe("website_widget");

    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("organizationId");
    expect(serialized).not.toContain("storageKey");
    expect(serialized).not.toContain("apiKey");
    expect(serialized).not.toContain("sk-");
    // CORS is present for cross-origin embedding.
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
  });

  it("rejects a request for an unknown public key", async () => {
    const store = new InMemoryStore();
    __resetStoreForTests(store);
    const request = new Request("http://localhost:3000/api/public/channels/tc_missing/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Hi" }),
    });
    const response = await POST(request, { params: { publicKey: "tc_missing" } });
    expect(response.status).toBe(404);
  });
});
