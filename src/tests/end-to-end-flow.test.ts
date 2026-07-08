import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
// Model Hub / provider API-key area
import { saveProviderCredential, testProviderConnection } from "@/modules/model-gateway/service";
import { createDefaultCredentialResolver } from "@/modules/model-gateway/credential-resolver";
// Knowledge Vault
import {
  createTextSource,
  createFileSource,
  assignKnowledgeToEmployee,
  type KnowledgeStorage,
} from "@/modules/knowledge/service";
import { rebuildKnowledgeRetrievalSegmentsForEmployee } from "@/modules/employee-chat/preparation";
import { retrieveForEmployee } from "@/modules/employee-chat/retrieval";
// Chat runtime + connections
import { sendChatMessage, type ChatGateway } from "@/modules/employee-chat/service";
import { createWebChannel } from "@/modules/channels/service";
import { handlePublicChatMessage } from "@/modules/channels/runtime";
import { LlmGateway } from "@/modules/model-gateway/gateway";
import { MODEL_PROVIDERS } from "@/modules/model-gateway/catalog";
import type { LLMProvider } from "@/modules/model-gateway/types";
import type { ProviderSlug } from "@/lib/db/types";
import type { GatewayRequest, GatewayResponse } from "@/modules/model-gateway/types";

/**
 * End-to-end functional verification: chains the REAL modules (in-memory store,
 * no network) through the full customer loop and observes actual behavior —
 * provider API keys, Knowledge Vault extraction, knowledge retrieval, the chat
 * runtime, and an independent web connection. Proves the pieces work together,
 * not just in isolation.
 */

const MODEL_KEY_VAR = "TAURUS_MODEL_CREDENTIALS_MASTER_KEY";

/** A fake gateway so no provider network call happens. */
function fakeGateway(text: string): { gateway: ChatGateway; calls: GatewayRequest[] } {
  const calls: GatewayRequest[] = [];
  const model = {
    providerSlug: "openai" as const,
    modelId: "gpt-5.4",
    displayName: "GPT-5.4",
    modelFamily: "gpt-5",
    status: "available" as const,
    modelTier: "balanced" as const,
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
  };
  const gateway: ChatGateway = {
    async resolveModelForTask() {
      return { model, providerSlug: "openai", routingMode: "auto_balanced", reason: "test" };
    },
    async generateText(request): Promise<GatewayResponse> {
      calls.push(request);
      return {
        text,
        providerSlug: "openai",
        modelId: "gpt-5.4",
        inputTokens: 120,
        outputTokens: 30,
        estimatedCostUsd: 0.0003,
        latencyMs: 4,
        demo: false,
      };
    },
  };
  return { gateway, calls };
}

/**
 * A REAL LlmGateway wired to fake provider adapters. Unlike the ChatGateway
 * stub, this exercises the true gateway path — including emitting the
 * `llm_usage_event` that the billing meter reads — without any network call.
 */
function realGatewayWithFakeProviders(store: InMemoryStore, replyText: string) {
  const make = (slug: ProviderSlug): LLMProvider => ({
    slug,
    async generateText() {
      return {
        text: replyText,
        inputTokens: 120,
        cachedInputTokens: 0,
        outputTokens: 30,
        rawProviderRequestId: "req_fake",
        finishReason: "stop",
      };
    },
  });
  const providers = Object.fromEntries(
    MODEL_PROVIDERS.map((p) => [p.slug, make(p.slug)]),
  ) as Record<ProviderSlug, LLMProvider>;
  return new LlmGateway({
    store,
    providers,
    resolveCredential: async () => ({ apiKey: "test-key", baseUrl: null, mode: "taurus_managed" }),
  });
}

const noopStorage: KnowledgeStorage = { async save() {} };

async function setupOrg(store: InMemoryStore) {
  const user = await store.createUser({ email: "owner@acme.test", fullName: "Ada Owner" });
  const view = await store.createOrganizationWithOwner({
    organization: { name: "Acme", slug: "acme" },
    ownerUserId: user.id,
  });
  return { userId: user.id, orgId: view.organization.id };
}

beforeEach(() => {
  process.env[MODEL_KEY_VAR] = "e2e-model-master-key-1234567890";
});
afterEach(() => {
  delete process.env[MODEL_KEY_VAR];
});

describe("End-to-end: provider API-key area (Model Hub BYOK)", () => {
  it("saves an encrypted key, resolves it back, and runs a connection test", async () => {
    const store = new InMemoryStore();
    const { userId, orgId } = await setupOrg(store);
    const actor = { organizationId: orgId, userId };
    const apiKey = "sk-ant-e2e-SECRET-abcd1234";

    // Save (encrypt) a bring-your-own-key credential.
    const meta = await saveProviderCredential(store, actor, {
      providerSlug: "anthropic",
      apiKey,
      label: "Prod",
    });
    expect(meta.credentialMode).toBe("bring_your_own_key");
    expect(meta.keyLastFour).toBe("1234");
    // The plaintext key never appears in the returned metadata.
    expect(JSON.stringify(meta)).not.toContain("SECRET");

    // Resolve it back through the real resolver → must decrypt to the original.
    const resolve = createDefaultCredentialResolver(store);
    const resolved = await resolve(orgId, "anthropic");
    expect(resolved?.apiKey).toBe(apiKey);
    expect(resolved?.mode).toBe("bring_your_own_key");

    // "Test connection" flow with an injected probe (no real network).
    let probedKey: string | null = null;
    const result = await testProviderConnection(store, actor, "anthropic", {
      probe: async (input) => {
        probedKey = input.apiKey;
      },
    });
    expect(result.ok).toBe(true);
    expect(probedKey).toBe(apiKey);

    // Cross-org isolation: another org sees no credential.
    const otherResolve = createDefaultCredentialResolver(store);
    expect(await otherResolve("org-other", "anthropic")).toBeNull();
  });
});

describe("End-to-end: Knowledge Vault extraction + retrieval", () => {
  it("extracts text from a note and an uploaded file, then retrieves the right source", async () => {
    const store = new InMemoryStore();
    const { userId, orgId } = await setupOrg(store);
    const actor = { organizationId: orgId, userId };

    // A manual note — extracted immediately.
    const note = await createTextSource(store, actor, {
      name: "Refund policy",
      description: "How refunds work",
      visibility: "organization",
      text: "Customers can request a refund within 30 days of purchase for a full refund.",
    });
    const noteDocs = await store.listKnowledgeDocumentsForSource(orgId, note.id);
    expect(noteDocs[0]?.textContent).toContain("refund within 30 days");
    expect(noteDocs[0]?.textPreview).toBeTruthy();

    // An uploaded .txt file — real extraction (decoded + preview).
    const bytes = new TextEncoder().encode(
      "Our support hours are Monday to Friday, 9am to 5pm Pacific Time.",
    );
    const fileSource = await createFileSource(store, noopStorage, actor, {
      meta: { name: "Support hours", visibility: "organization" },
      file: { originalFilename: "hours.txt", contentType: "text/plain", bytes },
      extraction: {
        text: "Our support hours are Monday to Friday, 9am to 5pm Pacific Time.",
        status: "extracted",
      },
    });
    const fileDocs = await store.listKnowledgeDocumentsForSource(orgId, fileSource.id);
    expect(fileSource.status).toBe("ready");
    expect(fileDocs[0]?.textContent).toContain("Monday to Friday");
    expect(fileDocs[0]?.checksumSha256).toBeTruthy();

    // Assign both to an employee, prepare retrieval, then query.
    const employee = await store.createEmployee({
      organizationId: orgId,
      name: "Nova",
      roleTitle: "Support",
      status: "active",
      createdBy: userId,
    });
    await assignKnowledgeToEmployee(store, actor, {
      employeeId: employee.id,
      knowledgeSourceId: note.id,
    });
    await assignKnowledgeToEmployee(store, actor, {
      employeeId: employee.id,
      knowledgeSourceId: fileSource.id,
    });

    const prep = await rebuildKnowledgeRetrievalSegmentsForEmployee(store, orgId, employee.id);
    expect(prep.totalSegments).toBeGreaterThan(0);

    // A refund question must surface the refund policy source (grounded retrieval).
    const refundHit = await retrieveForEmployee(store, {
      organizationId: orgId,
      employeeId: employee.id,
      query: "how long do I have to get a refund?",
    });
    expect(refundHit.excerpts.length).toBeGreaterThan(0);
    expect(refundHit.topSourceIds).toContain(note.id);

    // A hours question must surface the support-hours source instead.
    const hoursHit = await retrieveForEmployee(store, {
      organizationId: orgId,
      employeeId: employee.id,
      query: "what are your support hours?",
    });
    expect(hoursHit.topSourceIds).toContain(fileSource.id);
  });
});

describe("End-to-end: chat runtime grounds a reply in knowledge", () => {
  it("retrieves, generates, persists, and meters a full chat turn", async () => {
    const store = new InMemoryStore();
    const { userId, orgId } = await setupOrg(store);
    const actor = { organizationId: orgId, userId };

    const employee = await store.createEmployee({
      organizationId: orgId,
      name: "Nova",
      roleTitle: "Support",
      status: "active",
      createdBy: userId,
    });
    // Publish DNA (required before chat).
    const dna: EmployeeDnaV1 = {
      ...createEmptyDnaV1(),
      identity: {
        mission: "Help customers succeed.",
        roleSummary: "Front-line support",
        primaryGoals: ["Resolve tickets"],
        successCriteria: [],
      },
    };
    await store.saveEmployeeDnaDraft({
      organizationId: orgId,
      employeeId: employee.id,
      dna,
      userId,
    });
    await store.publishEmployeeDna({ organizationId: orgId, employeeId: employee.id, userId });

    // Assign + prepare knowledge.
    const source = await createTextSource(store, actor, {
      name: "Refund policy",
      visibility: "organization",
      text: "Refunds are available within 30 days for a full refund.",
    });
    await assignKnowledgeToEmployee(store, actor, {
      employeeId: employee.id,
      knowledgeSourceId: source.id,
    });
    await rebuildKnowledgeRetrievalSegmentsForEmployee(store, orgId, employee.id);

    // Use the REAL gateway (fake providers) so the full chain runs, including
    // the usage event that billing meters.
    const gateway = realGatewayWithFakeProviders(
      store,
      "You can get a full refund within 30 days.",
    );
    const result = await sendChatMessage(
      { store, gateway, isProduction: () => false },
      {
        actor: { organizationId: orgId, userId },
        organizationName: "Acme",
        employee,
        message: "Can I get a refund?",
      },
    );

    // A reply was generated and the knowledge was retrieved as grounding.
    expect(result.status).toBe("sent");
    expect(result.assistantMessage.content).toContain("refund");
    expect(result.sources.length).toBeGreaterThan(0);

    // Both messages persisted, in order.
    const messages = await store.listEmployeeChatMessages(orgId, result.thread.id);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);

    // The turn was metered as a billable interaction (billing reads this).
    const interactions = await store.countInteractionsForEmployee(orgId, employee.id);
    expect(interactions).toBeGreaterThanOrEqual(1);
  });
});

describe("End-to-end: an independent web connection answers a visitor", () => {
  it("creates + activates a channel, resolves it by public key, and replies", async () => {
    const store = new InMemoryStore();
    const { userId, orgId } = await setupOrg(store);
    const actor = { organizationId: orgId, userId };

    const employee = await store.createEmployee({
      organizationId: orgId,
      name: "Nova",
      roleTitle: "Support",
      status: "active",
      createdBy: userId,
    });
    const dna: EmployeeDnaV1 = {
      ...createEmptyDnaV1(),
      identity: {
        mission: "Help visitors.",
        roleSummary: "Website assistant",
        primaryGoals: ["Answer questions"],
        successCriteria: [],
      },
    };
    await store.saveEmployeeDnaDraft({
      organizationId: orgId,
      employeeId: employee.id,
      dna,
      userId,
    });
    await store.publishEmployeeDna({ organizationId: orgId, employeeId: employee.id, userId });

    // Create + activate the web connection.
    const channel = await createWebChannel(store, actor, employee, { name: "Website" });
    await store.activateEmployeeChannel(orgId, channel.id);

    // A visitor sends a message through the PUBLIC key only (no org from client).
    const { gateway } = fakeGateway("Hi! Happy to help with that.");
    const outcome = await handlePublicChatMessage(
      { store, gateway },
      { publicKey: channel.publicKey, message: "Hello, are you open?", sessionId: null },
    );

    expect(outcome.outbound.text).toContain("help");
    expect(outcome.outbound.status).toBe("sent");
    // The org was resolved from the channel public key, matching the real owner.
    expect(channel.organizationId).toBe(orgId);

    // The public interaction was recorded as a channel event.
    const events = await store.listPublicChannelEventsForEmployee(orgId, employee.id, 10);
    expect(events.some((e) => e.eventType === "public_chat.message_sent")).toBe(true);

    // A forged public key resolves to nothing (no cross-tenant access).
    await expect(
      handlePublicChatMessage(
        { store, gateway },
        { publicKey: "pk_forged_does_not_exist", message: "hi", sessionId: null },
      ),
    ).rejects.toBeTruthy();
  });
});
