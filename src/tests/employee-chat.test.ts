import { describe, it, expect } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import { rankSegments } from "@/modules/employee-chat/scoring";
import { retrieveForEmployee } from "@/modules/employee-chat/retrieval";
import { rebuildKnowledgeRetrievalSegmentsForEmployee } from "@/modules/employee-chat/preparation";
import {
  sendChatMessage,
  ChatBlockedError,
  type ChatGateway,
} from "@/modules/employee-chat/service";
import { LlmGateway } from "@/modules/model-gateway/gateway";
import { generateLocalDemoAnswer } from "@/modules/model-gateway/local-demo-brain";
import { DEFAULT_PROVIDERS } from "@/modules/model-gateway/providers";
import type { AiEmployee, CreateKnowledgeSourceInput, KnowledgeSource } from "@/lib/db/types";
import type { GatewayRequest, GatewayResponse } from "@/modules/model-gateway/types";

// --- Test fixtures ----------------------------------------------------------

async function seedEmployee(
  store: InMemoryStore,
  organizationId: string,
  overrides: Partial<AiEmployee> = {},
): Promise<AiEmployee> {
  return store.createEmployee({
    organizationId,
    name: overrides.name ?? "Nova Assistant",
    roleTitle: overrides.roleTitle ?? "Support Specialist",
    department: overrides.department ?? "Customer Success",
    description: null,
    status: overrides.status ?? "active",
    createdBy: null,
  });
}

async function publishDna(store: InMemoryStore, organizationId: string, employeeId: string) {
  const dna: EmployeeDnaV1 = {
    ...createEmptyDnaV1(),
    identity: {
      mission: "Help customers succeed.",
      roleSummary: "Front-line support",
      primaryGoals: ["Resolve tickets"],
      successCriteria: [],
    },
  };
  await store.saveEmployeeDnaDraft({ organizationId, employeeId, dna, userId: "user-1" });
  await store.publishEmployeeDna({ organizationId, employeeId, userId: "user-1" });
}

async function seedSource(
  store: InMemoryStore,
  input: CreateKnowledgeSourceInput,
  text: string,
): Promise<KnowledgeSource> {
  const source = await store.createKnowledgeSource(input);
  await store.updateKnowledgeSource(input.organizationId, source.id, { status: "ready" });
  await store.createKnowledgeDocument({
    organizationId: input.organizationId,
    knowledgeSourceId: source.id,
    title: source.name,
    textContent: text,
    textPreview: text.slice(0, 100),
    extractionStatus: "extracted",
  });
  return (await store.getKnowledgeSource(input.organizationId, source.id))!;
}

/** A fake gateway: records calls and never touches the network. */
function fakeGateway(text = "Grounded answer."): {
  gateway: ChatGateway;
  calls: GatewayRequest[];
} {
  const calls: GatewayRequest[] = [];
  const gateway: ChatGateway = {
    async resolveModelForTask(request) {
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
        inputTokens: 100,
        outputTokens: 20,
        estimatedCostUsd: 0.0002,
        latencyMs: 5,
        demo: false,
      };
    },
  };
  return { gateway, calls };
}

const actor = { organizationId: "org-1", userId: "user-1" };
const baseParams = { actor, organizationName: "Acme" };

// --- Scoring & retrieval ----------------------------------------------------

describe("Lexical scoring", () => {
  it("returns relevant excerpts and drops irrelevant ones", () => {
    const now = "2026-01-01T00:00:00.000Z";
    const mk = (id: string, title: string, content: string) => ({
      id,
      organizationId: "org-1",
      knowledgeSourceId: "s1",
      knowledgeDocumentId: "d1",
      title,
      content,
      contentPreview: content.slice(0, 40),
      segmentIndex: 0,
      status: "ready" as const,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    });
    const segments = [
      mk("a", "Refund policy", "Customers can request a refund within 30 days of purchase."),
      mk("b", "Office hours", "Our office is open weekdays from nine to five."),
    ];
    const ranked = rankSegments("How do I get a refund?", segments, 5);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0].segment.id).toBe("a");
    expect(ranked.every((r) => r.score > 0)).toBe(true);
  });

  it("returns nothing for an all-stopword query", () => {
    expect(rankSegments("the a of", [], 5)).toEqual([]);
  });
});

describe("Retrieval", () => {
  it("searches only knowledge assigned to the employee", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, "org-1");
    const assigned = await seedSource(
      store,
      {
        organizationId: "org-1",
        name: "Refund policy",
        description: null,
        sourceType: "text",
        visibility: "organization",
      },
      "Refunds are available within 30 days of purchase.",
    );
    await seedSource(
      store,
      {
        organizationId: "org-1",
        name: "Secret pricing",
        description: null,
        sourceType: "text",
        visibility: "organization",
      },
      "Refund coupons and pricing secrets live here.",
    );
    await store.assignKnowledgeSourceToEmployee({
      organizationId: "org-1",
      employeeId: emp.id,
      knowledgeSourceId: assigned.id,
    });
    await rebuildKnowledgeRetrievalSegmentsForEmployee(store, "org-1", emp.id);

    const result = await retrieveForEmployee(store, {
      organizationId: "org-1",
      employeeId: emp.id,
      query: "refund",
    });
    expect(result.topSourceIds).toEqual([assigned.id]);
    expect(result.excerpts.every((e) => e.sourceId === assigned.id)).toBe(true);
  });

  it("excludes archived assigned sources", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, "org-1");
    const src = await seedSource(
      store,
      {
        organizationId: "org-1",
        name: "Refund policy",
        description: null,
        sourceType: "text",
        visibility: "organization",
      },
      "Refunds within 30 days.",
    );
    await store.assignKnowledgeSourceToEmployee({
      organizationId: "org-1",
      employeeId: emp.id,
      knowledgeSourceId: src.id,
    });
    await rebuildKnowledgeRetrievalSegmentsForEmployee(store, "org-1", emp.id);
    await store.archiveKnowledgeSource("org-1", src.id);

    const result = await retrieveForEmployee(store, {
      organizationId: "org-1",
      employeeId: emp.id,
      query: "refund",
    });
    expect(result.excerpts).toHaveLength(0);
  });

  it("enforces organization isolation on retrieval", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, "org-1");
    const src = await seedSource(
      store,
      {
        organizationId: "org-1",
        name: "Refund policy",
        description: null,
        sourceType: "text",
        visibility: "organization",
      },
      "Refunds within 30 days.",
    );
    await store.assignKnowledgeSourceToEmployee({
      organizationId: "org-1",
      employeeId: emp.id,
      knowledgeSourceId: src.id,
    });
    await rebuildKnowledgeRetrievalSegmentsForEmployee(store, "org-1", emp.id);

    // Another organization must see nothing for the same employee id.
    const result = await retrieveForEmployee(store, {
      organizationId: "org-2",
      employeeId: emp.id,
      query: "refund",
    });
    expect(result.excerpts).toHaveLength(0);
  });

  it("does not prepare unsupported (pdf/docx) documents", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, "org-1");
    const source = await store.createKnowledgeSource({
      organizationId: "org-1",
      name: "Handbook.pdf",
      description: null,
      sourceType: "file",
      visibility: "organization",
    });
    await store.updateKnowledgeSource("org-1", source.id, { status: "ready" });
    await store.createKnowledgeDocument({
      organizationId: "org-1",
      knowledgeSourceId: source.id,
      title: "Handbook.pdf",
      textContent: null,
      extractionStatus: "unsupported",
    });
    await store.assignKnowledgeSourceToEmployee({
      organizationId: "org-1",
      employeeId: emp.id,
      knowledgeSourceId: source.id,
    });
    const prep = await rebuildKnowledgeRetrievalSegmentsForEmployee(store, "org-1", emp.id);
    expect(prep.totalSegments).toBe(0);
  });
});

// --- Local Demo Brain -------------------------------------------------------

describe("Local Demo Brain", () => {
  it("grounds its answer in provided excerpts", () => {
    const system =
      "HOW TO ANSWER:\n1. ...\n\nASSIGNED KNOWLEDGE VAULT EXCERPTS:\n[1] Refund policy: Refunds within 30 days.";
    const result = generateLocalDemoAnswer({
      modelId: "gpt-5.4",
      system,
      messages: [{ role: "user", content: "How do refunds work?" }],
      maxOutputTokens: null,
      apiKey: "",
      baseUrl: null,
    });
    expect(result.text).toContain("Refund policy");
  });

  it("admits when it has no approved knowledge", () => {
    const system = "ASSIGNED KNOWLEDGE VAULT EXCERPTS:\n(none available)";
    const result = generateLocalDemoAnswer({
      modelId: "gpt-5.4",
      system,
      messages: [{ role: "user", content: "What is our refund policy?" }],
      maxOutputTokens: null,
      apiKey: "",
      baseUrl: null,
    });
    expect(result.text.toLowerCase()).toContain("don't have enough approved company knowledge");
  });

  it("is deterministic for the same input", () => {
    const input = {
      modelId: "gpt-5.4",
      system: "ASSIGNED KNOWLEDGE VAULT EXCERPTS:\n(none available)",
      messages: [{ role: "user" as const, content: "hi" }],
      maxOutputTokens: null,
      apiKey: "",
      baseUrl: null,
    };
    expect(generateLocalDemoAnswer(input).text).toBe(generateLocalDemoAnswer(input).text);
  });
});

// --- Chat service governance + gateway usage --------------------------------

describe("Employee Chat service", () => {
  it("blocks generation when there is no published Employee DNA", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, "org-1");
    const { gateway, calls } = fakeGateway();
    await expect(
      sendChatMessage({ store, gateway }, { ...baseParams, employee: emp, message: "Hello" }),
    ).rejects.toBeInstanceOf(ChatBlockedError);
    expect(calls).toHaveLength(0); // model never called
  });

  it("blocks a chat with an archived employee", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, "org-1", { status: "archived" });
    await publishDna(store, "org-1", emp.id);
    const { gateway } = fakeGateway();
    await expect(
      sendChatMessage({ store, gateway }, { ...baseParams, employee: emp, message: "Hello" }),
    ).rejects.toBeInstanceOf(ChatBlockedError);
  });

  it("calls the Model Gateway (not a provider adapter) and stores both messages", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, "org-1");
    await publishDna(store, "org-1", emp.id);
    const { gateway, calls } = fakeGateway("Here is your grounded answer.");

    const result = await sendChatMessage(
      { store, gateway, isLiveProviderConfigured: async () => true },
      { ...baseParams, employee: emp, message: "How do refunds work?" },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].taskType).toBe("employee_chat");
    expect(result.status).toBe("sent");
    expect(result.assistantMessage.content).toBe("Here is your grounded answer.");

    const messages = await store.listEmployeeChatMessages("org-1", result.thread.id);
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(messages[1].modelProviderSlug).toBe("openai");
    expect(messages[1].modelId).toBe("gpt-5.4");
  });

  it("attaches source references to the assistant message", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, "org-1");
    await publishDna(store, "org-1", emp.id);
    const src = await seedSource(
      store,
      {
        organizationId: "org-1",
        name: "Refund policy",
        description: null,
        sourceType: "text",
        visibility: "organization",
      },
      "Refunds are available within 30 days of purchase.",
    );
    await store.assignKnowledgeSourceToEmployee({
      organizationId: "org-1",
      employeeId: emp.id,
      knowledgeSourceId: src.id,
    });
    await rebuildKnowledgeRetrievalSegmentsForEmployee(store, "org-1", emp.id);

    const { gateway } = fakeGateway();
    const result = await sendChatMessage(
      { store, gateway, isLiveProviderConfigured: async () => true },
      { ...baseParams, employee: emp, message: "How do I get a refund?" },
    );
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources[0].name).toBe("Refund policy");
    expect(result.assistantMessage.sourceReferences?.[0].sourceId).toBe(src.id);
  });

  it("records usage metadata and audit events without message text", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, "org-1");
    await publishDna(store, "org-1", emp.id);
    const { gateway } = fakeGateway();

    await sendChatMessage(
      { store, gateway, isLiveProviderConfigured: async () => true },
      { ...baseParams, employee: emp, message: "SENSITIVE-QUESTION-XYZ" },
    );

    const audits = store._auditEvents();
    expect(audits.some((a) => a.action === "employee_chat.message_sent")).toBe(true);
    expect(audits.some((a) => a.action === "employee_chat.response_generated")).toBe(true);
    // Audit metadata must never contain the raw message text.
    expect(JSON.stringify(audits)).not.toContain("SENSITIVE-QUESTION-XYZ");
    // Retrieval events store a hash, not the question.
    const retrieval = audits.filter((a) => a.action === "knowledge_retrieval.searched");
    expect(retrieval.length).toBeGreaterThan(0);
    expect(JSON.stringify(retrieval)).not.toContain("SENSITIVE-QUESTION-XYZ");
  });

  it("uses the demo brain in dev/test but refuses silently in production", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, "org-1");
    await publishDna(store, "org-1", emp.id);

    // Real gateway with demo enabled (dev/test) + no live provider → demo answer.
    const devGateway = new LlmGateway({
      store,
      providers: DEFAULT_PROVIDERS,
      resolveCredential: async () => null,
      demo: { allowed: true, generate: generateLocalDemoAnswer },
    });
    const devResult = await sendChatMessage(
      {
        store,
        gateway: devGateway,
        isLiveProviderConfigured: async () => false,
        isProduction: () => false,
      },
      { ...baseParams, employee: emp, message: "What are your hours?" },
    );
    expect(devResult.demo).toBe(true);
    expect(devResult.assistantMessage.brainMode).toBe("local_demo");

    // Production gate: no live provider → blocked before any generation.
    await expect(
      sendChatMessage(
        {
          store,
          gateway: devGateway,
          isLiveProviderConfigured: async () => false,
          isProduction: () => true,
        },
        { ...baseParams, employee: emp, message: "What are your hours?" },
      ),
    ).rejects.toBeInstanceOf(ChatBlockedError);
  });

  it("does not call external providers: production demo path throws provider_not_configured", async () => {
    const store = new InMemoryStore();
    // A production gateway (demo disallowed) with no credential must not run a provider.
    const prodGateway = new LlmGateway({
      store,
      providers: DEFAULT_PROVIDERS,
      resolveCredential: async () => null,
      demo: { allowed: false, generate: generateLocalDemoAnswer },
    });
    await expect(
      prodGateway.generateText({
        organizationId: "org-1",
        taskType: "employee_chat",
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toThrow(/not configured/i);
  });

  it("cross-organization employee access yields no knowledge and no leakage", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, "org-1");
    await publishDna(store, "org-1", emp.id);
    // org-2 has no such employee; getEmployee is org-scoped so the page would 404.
    expect(await store.getEmployee("org-2", emp.id)).toBeNull();
  });
});
