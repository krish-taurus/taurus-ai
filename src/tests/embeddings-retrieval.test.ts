import { describe, expect, it } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { setModelAccessMode } from "@/modules/usage/access-mode";
import {
  chunkPassages,
  cosineSimilarity,
  createLocalEmbedder,
  type Embedder,
} from "@/modules/knowledge/embeddings";
import {
  backfillOrganization,
  indexKnowledgeSource,
  EmbeddingAccessError,
  type KnowledgeContext,
} from "@/modules/knowledge/indexing";
import { retrieveForEmployee } from "@/modules/employee-chat/retrieval";
import type { CostTier } from "@/modules/usage/model-pricing";

// --- A deterministic topic-based stub embedder (fixed vectors) ---------------
function topicVector(text: string): number[] {
  const t = text.toLowerCase();
  if (/refund|return|days|window|money back/.test(t)) return [1, 0, 0];
  if (/hours|open|weekday|office/.test(t)) return [0, 1, 0];
  return [0.2, 0.2, 1];
}
function stubEmbedder(opts: { costTier?: CostTier; costUsd?: number; modelId?: string } = {}): Embedder {
  return {
    modelId: opts.modelId ?? "stub-embed-v1",
    providerSlug: "openai",
    dim: 3,
    costTier: opts.costTier ?? "budget",
    async embed(texts) {
      return {
        vectors: texts.map(topicVector),
        inputTokens: texts.length * 5,
        costUsd: opts.costUsd ?? 0.01,
      };
    },
  };
}

async function makeOrg(store: InMemoryStore, name: string) {
  const user = await store.createUser({ email: `${name}@example.com` });
  const view = await store.createOrganizationWithOwner({
    organization: { name, slug: name },
    ownerUserId: user.id,
  });
  return { orgId: view.organization.id, userId: user.id };
}

function ctxFor(orgId: string, userId: string): KnowledgeContext {
  return { organizationId: orgId, userId, role: "owner" };
}

/** Create a source with one text document, optionally assigned to an employee. */
async function makeSource(
  store: InMemoryStore,
  orgId: string,
  text: string,
  opts: { employeeId?: string; name?: string } = {},
) {
  // Each source gets its own vault so assigning it to one employee doesn't leak
  // to another (mirrors the old per-source isolation).
  const vault = await store.createKnowledgeVault({
    organizationId: orgId,
    name: opts.name ?? "Support docs",
  });
  const source = await store.createKnowledgeSource({
    organizationId: orgId,
    vaultId: vault.id,
    name: opts.name ?? "Support docs",
    sourceType: "text",
    status: "ready",
  });
  await store.createKnowledgeDocument({
    organizationId: orgId,
    knowledgeSourceId: source.id,
    title: "Doc",
    textContent: text,
    extractionStatus: "not_required",
  });
  if (opts.employeeId) {
    await store.assignVaultToEmployee({
      organizationId: orgId,
      employeeId: opts.employeeId,
      vaultId: vault.id,
    });
  }
  return source.id;
}

async function makeEmployee(store: InMemoryStore, orgId: string, userId: string) {
  const e = await store.createEmployee({
    organizationId: orgId,
    name: "Nova",
    roleTitle: "Support",
    status: "active",
    createdBy: userId,
  });
  return e.id;
}

// ===========================================================================
// Chunking
// ===========================================================================
describe("chunkPassages", () => {
  it("produces overlapping passages of the right size, in order", () => {
    const words = Array.from({ length: 2000 }, (_, i) => `w${i}`).join(" ");
    const chunks = chunkPassages(words, { chunkSize: 800, overlap: 100 });
    // step = 700 → starts at 0, 700, 1400 → 3 chunks.
    expect(chunks.length).toBe(3);
    const first = chunks[0].split(" ");
    const second = chunks[1].split(" ");
    expect(first).toHaveLength(800);
    // Overlap: the last 100 of chunk 0 equal the first 100 of chunk 1.
    expect(first.slice(700)).toEqual(second.slice(0, 100));
    // Stable order.
    expect(chunks[0].startsWith("w0 ")).toBe(true);
    expect(chunks[1].startsWith("w700 ")).toBe(true);
  });

  it("returns a single passage for short text and nothing for empty", () => {
    expect(chunkPassages("just a few words", { chunkSize: 800 })).toEqual(["just a few words"]);
    expect(chunkPassages("   ")).toEqual([]);
  });
});

// ===========================================================================
// Embedding (indexing) — model/dim recorded, cost, access mode
// ===========================================================================
describe("indexKnowledgeSource", () => {
  it("records the model id + dimension on chunks and a managed usage-cost event", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "idx");
    const sourceId = await makeSource(store, orgId, "Customers may return items within 30 days.");

    const result = await indexKnowledgeSource(store, stubEmbedder(), ctxFor(orgId, userId), sourceId);
    expect(result.ready).toBe(true);
    expect(result.chunkCount).toBe(1);

    const segments = await store.listKnowledgeRetrievalSegmentsForSource(orgId, sourceId);
    expect(segments[0].embeddingModelId).toBe("stub-embed-v1");
    expect(segments[0].embeddingDim).toBe(3);
    expect(segments[0].embedding).toEqual([1, 0, 0]);
    expect((await store.getKnowledgeSource(orgId, sourceId))?.indexingState).toBe("ready");

    const usage = (await store.listLlmUsageEvents(orgId, 100)).filter(
      (u) => u.taskType === "embedding",
    );
    expect(usage).toHaveLength(1);
    expect(usage[0].costUsd).toBeCloseTo(0.01, 5);
    expect(usage[0].byok).toBe(false);
  });

  it("records cost 0 for a BYOK organization", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "byokidx");
    await setModelAccessMode(store, { organizationId: orgId, userId }, "byok");
    const sourceId = await makeSource(store, orgId, "Return window is 30 days.");

    await indexKnowledgeSource(store, stubEmbedder(), ctxFor(orgId, userId), sourceId);
    const usage = (await store.listLlmUsageEvents(orgId, 100)).filter(
      (u) => u.taskType === "embedding",
    );
    expect(usage[0].byok).toBe(true);
    expect(usage[0].costUsd).toBe(0);
  });

  it("rejects a frontier embedding model in managed mode", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "frontieridx");
    const sourceId = await makeSource(store, orgId, "Return window is 30 days.");
    await expect(
      indexKnowledgeSource(store, stubEmbedder({ costTier: "frontier" }), ctxFor(orgId, userId), sourceId),
    ).rejects.toBeInstanceOf(EmbeddingAccessError);
  });

  it("permits a frontier embedding model in BYOK mode", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "frontierbyok");
    await setModelAccessMode(store, { organizationId: orgId, userId }, "byok");
    const sourceId = await makeSource(store, orgId, "Return window is 30 days.");
    const result = await indexKnowledgeSource(
      store,
      stubEmbedder({ costTier: "frontier" }),
      ctxFor(orgId, userId),
      sourceId,
    );
    expect(result.ready).toBe(true);
  });
});

// ===========================================================================
// Hybrid retrieval
// ===========================================================================
describe("Hybrid retrieval", () => {
  it("returns the semantically-relevant chunk even when wording differs", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "sem");
    const empId = await makeEmployee(store, orgId, userId);
    const embedder = stubEmbedder();
    await makeSource(store, orgId, "Customers may bring items back within 30 days for their money back.", {
      employeeId: empId,
      name: "Returns",
    });
    await makeSource(store, orgId, "Our office is open weekdays from nine to five.", {
      employeeId: empId,
      name: "Hours",
    });
    // Index both (chunk + embed).
    for (const s of await store.listKnowledgeSourcesForEmployee(orgId, empId)) {
      await indexKnowledgeSource(store, embedder, ctxFor(orgId, userId), s.id);
    }

    // Query wording shares NO keywords with the returns chunk ("return window").
    const result = await retrieveForEmployee(store, {
      organizationId: orgId,
      employeeId: empId,
      query: "how long is the return window",
      embedder,
    });
    expect(result.excerpts.length).toBeGreaterThan(0);
    expect(result.excerpts[0].name).toBe("Returns");
  });

  it("dedupes a chunk that matches both lexical and semantic signals", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "dedupe");
    const empId = await makeEmployee(store, orgId, userId);
    const embedder = stubEmbedder();
    await makeSource(store, orgId, "Refund policy: a refund is available within 30 days.", {
      employeeId: empId,
    });
    for (const s of await store.listKnowledgeSourcesForEmployee(orgId, empId)) {
      await indexKnowledgeSource(store, embedder, ctxFor(orgId, userId), s.id);
    }
    const result = await retrieveForEmployee(store, {
      organizationId: orgId,
      employeeId: empId,
      query: "refund within 30 days",
      embedder,
    });
    // One chunk, one excerpt — no duplicate from appearing in both signals.
    expect(result.excerpts).toHaveLength(1);
  });

  it("is strictly org- and assignment-scoped; cross-org returns nothing", async () => {
    const store = new InMemoryStore();
    const a = await makeOrg(store, "orga");
    const b = await makeOrg(store, "orgb");
    const empA = await makeEmployee(store, a.orgId, a.userId);
    const empB = await makeEmployee(store, b.orgId, b.userId);
    const embedder = stubEmbedder();

    // Assigned to empA only.
    const srcId = await makeSource(store, a.orgId, "Refund within 30 days.", { employeeId: empA });
    // An unassigned source in org A.
    await makeSource(store, a.orgId, "Refund within 30 days.", { name: "Unassigned" });
    await indexKnowledgeSource(store, embedder, ctxFor(a.orgId, a.userId), srcId);
    for (const s of await store.listKnowledgeSources(a.orgId)) {
      await indexKnowledgeSource(store, embedder, ctxFor(a.orgId, a.userId), s.id);
    }

    // empB (other org) sees nothing.
    const crossOrg = await retrieveForEmployee(store, {
      organizationId: b.orgId,
      employeeId: empB,
      query: "refund",
      embedder,
    });
    expect(crossOrg.excerpts).toHaveLength(0);

    // empA sees only the assigned source's chunk (not the unassigned one).
    const scoped = await retrieveForEmployee(store, {
      organizationId: a.orgId,
      employeeId: empA,
      query: "refund",
      embedder,
    });
    expect(scoped.excerpts.every((e) => e.sourceId === srcId)).toBe(true);
  });
});

// ===========================================================================
// Store parity (in-memory cosine matches the reference metric)
// ===========================================================================
describe("Semantic search parity", () => {
  it("orders by cosine similarity identically to a reference computation", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "parity");
    const empId = await makeEmployee(store, orgId, userId);
    const srcId = await makeSource(store, orgId, "seed", { employeeId: empId });
    // Hand-place three embedded chunks with known vectors.
    await store.deleteKnowledgeRetrievalSegmentsForSource(orgId, srcId);
    const vectors: Record<string, number[]> = {
      near: [0.9, 0.1, 0],
      mid: [0.5, 0.5, 0],
      far: [0, 0, 1],
    };
    let i = 0;
    for (const [name, vec] of Object.entries(vectors)) {
      await store.createKnowledgeRetrievalSegments([
        {
          organizationId: orgId,
          knowledgeSourceId: srcId,
          title: name,
          content: name,
          contentPreview: name,
          segmentIndex: i++,
          embedding: vec,
          embeddingModelId: "m",
          embeddingDim: 3,
        },
      ]);
    }
    const query = [1, 0, 0];
    const hits = await store.semanticSearchKnowledgeRetrievalSegments(orgId, empId, query, 10);

    const reference = Object.entries(vectors)
      .map(([name, vec]) => ({ name, sim: cosineSimilarity(query, vec) }))
      .filter((r) => r.sim > 0) // orthogonal (sim 0) chunks are dropped, like lexical
      .sort((a, b) => b.sim - a.sim)
      .map((r) => r.name);
    expect(hits.map((h) => h.segment.title)).toEqual(reference);
    expect(hits[0].similarity).toBeGreaterThan(hits[1].similarity);
  });
});

// ===========================================================================
// Lifecycle
// ===========================================================================
describe("Indexing lifecycle", () => {
  it("re-indexing is idempotent (chunks recreated, not duplicated)", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "life");
    const sourceId = await makeSource(store, orgId, Array.from({ length: 1600 }, (_, i) => `w${i}`).join(" "));
    const ctx = ctxFor(orgId, userId);

    const first = await indexKnowledgeSource(store, stubEmbedder(), ctx, sourceId);
    const countAfterFirst = (await store.listKnowledgeRetrievalSegmentsForSource(orgId, sourceId)).length;
    const second = await indexKnowledgeSource(store, stubEmbedder(), ctx, sourceId);
    const countAfterSecond = (await store.listKnowledgeRetrievalSegmentsForSource(orgId, sourceId)).length;
    expect(first.chunkCount).toBe(second.chunkCount);
    expect(countAfterSecond).toBe(countAfterFirst); // no growth
  });

  it("archiving a source removes its chunks (no orphans)", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "archive");
    const sourceId = await makeSource(store, orgId, "Refund within 30 days.");
    const ctx = ctxFor(orgId, userId);
    await indexKnowledgeSource(store, stubEmbedder(), ctx, sourceId);
    expect((await store.listKnowledgeRetrievalSegmentsForSource(orgId, sourceId)).length).toBeGreaterThan(0);

    await store.updateKnowledgeSource(orgId, sourceId, { status: "archived" });
    await indexKnowledgeSource(store, stubEmbedder(), ctx, sourceId);
    expect(await store.listKnowledgeRetrievalSegmentsForSource(orgId, sourceId)).toHaveLength(0);
  });

  it("backfill embeds every source and is idempotent", async () => {
    const store = new InMemoryStore();
    const { orgId, userId } = await makeOrg(store, "backfill");
    await makeSource(store, orgId, "Refund within 30 days.", { name: "A" });
    await makeSource(store, orgId, "Office hours are weekdays.", { name: "B" });
    const ctx = ctxFor(orgId, userId);

    const first = await backfillOrganization(store, stubEmbedder(), ctx);
    expect(first.filter((r) => r.ready)).toHaveLength(2);
    const totalFirst = (
      await Promise.all(
        (await store.listKnowledgeSources(orgId)).map((s) =>
          store.listKnowledgeRetrievalSegmentsForSource(orgId, s.id),
        ),
      )
    ).reduce((sum, segs) => sum + segs.length, 0);

    await backfillOrganization(store, stubEmbedder(), ctx);
    const totalSecond = (
      await Promise.all(
        (await store.listKnowledgeSources(orgId)).map((s) =>
          store.listKnowledgeRetrievalSegmentsForSource(orgId, s.id),
        ),
      )
    ).reduce((sum, segs) => sum + segs.length, 0);
    expect(totalSecond).toBe(totalFirst); // idempotent
  });
});
