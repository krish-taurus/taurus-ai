/**
 * Knowledge indexing (Sprint 019) — server only.
 *
 * Chunks a Knowledge Vault source into overlapping passages, embeds them via the
 * injected `Embedder`, and stores the vectors on the retrieval segments so chat
 * retrieval can be hybrid. Respects the org's model access mode (managed →
 * budget/mid + cost recorded; BYOK → cost 0; frontier is BYOK-only) and records a
 * usage-cost event per embedding call (Sprint 016 capture). No provider SDK here.
 */

import type { DataStore } from "@/lib/db/store";
import type {
  CreateKnowledgeRetrievalSegmentInput,
  KnowledgeDocument,
  ProviderSlug,
} from "@/lib/db/types";
import type { Role } from "@/modules/organizations/roles";
import { hasPermission } from "@/modules/organizations/roles";
import { isDocumentChatReady } from "@/modules/employee-chat/preparation";
import {
  chunkPassages,
  DEFAULT_CHUNK_OVERLAP,
  DEFAULT_CHUNK_SIZE,
  type ChunkOptions,
  type Embedder,
} from "@/modules/knowledge/embeddings";

export interface KnowledgeContext {
  organizationId: string;
  userId: string;
  role: Role;
}

export class KnowledgePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgePermissionError";
  }
}
/** Frontier embedding model requested in managed mode — blocked (BYOK-only). */
export class EmbeddingAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingAccessError";
  }
}

export interface IndexResult {
  sourceId: string;
  chunkCount: number;
  ready: boolean;
}

function assertManage(ctx: KnowledgeContext): void {
  if (!hasPermission(ctx.role, "knowledge.manage")) {
    throw new KnowledgePermissionError("You do not have permission to manage knowledge.");
  }
}

function preview(text: string, max = 200): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Build passage inputs (with parent refs + stable order) from a source's docs. */
function buildPassages(
  organizationId: string,
  sourceId: string,
  sourceName: string,
  sourceType: string,
  documents: KnowledgeDocument[],
  options: ChunkOptions,
): Array<Omit<CreateKnowledgeRetrievalSegmentInput, "embedding" | "embeddingModelId" | "embeddingDim">> {
  const inputs: Array<Omit<CreateKnowledgeRetrievalSegmentInput, "embedding" | "embeddingModelId" | "embeddingDim">> = [];
  let index = 0;
  for (const doc of documents) {
    if (!isDocumentChatReady(doc)) continue;
    for (const passage of chunkPassages(doc.textContent ?? "", options)) {
      inputs.push({
        organizationId,
        knowledgeSourceId: sourceId,
        knowledgeDocumentId: doc.id,
        title: sourceName,
        content: passage,
        contentPreview: preview(passage),
        segmentIndex: index++,
        metadata: { sourceName, sourceType, documentTitle: doc.title },
      });
    }
  }
  return inputs;
}

export interface IndexOptions extends ChunkOptions {}

/**
 * (Re)index one source: chunk → embed → store, setting its indexing state. Safe
 * to re-run (idempotent: segments are dropped and recreated). Cross-org access
 * returns "not found" behavior via the org-scoped store reads.
 */
export async function indexKnowledgeSource(
  store: DataStore,
  embedder: Embedder,
  ctx: KnowledgeContext,
  sourceId: string,
  options: IndexOptions = {},
): Promise<IndexResult> {
  assertManage(ctx);

  const organization = await store.getOrganizationById(ctx.organizationId);
  const accessMode = organization?.modelAccessMode ?? "managed";
  // Frontier embedding models are BYOK-only — never run in a managed plan.
  if (accessMode === "managed" && embedder.costTier === "frontier") {
    throw new EmbeddingAccessError(
      "This embedding model requires your own API key. Switch to bring-your-own-key or choose a budget model.",
    );
  }

  const source = await store.getKnowledgeSource(ctx.organizationId, sourceId);
  if (!source || source.status === "archived") {
    await store.deleteKnowledgeRetrievalSegmentsForSource(ctx.organizationId, sourceId);
    if (source) await store.updateKnowledgeSourceIndexingState(ctx.organizationId, sourceId, "pending");
    return { sourceId, chunkCount: 0, ready: false };
  }

  await store.updateKnowledgeSourceIndexingState(ctx.organizationId, sourceId, "indexing");
  try {
    const documents = await store.listKnowledgeDocumentsForSource(ctx.organizationId, sourceId);
    const passages = buildPassages(
      ctx.organizationId,
      sourceId,
      source.name,
      source.sourceType,
      documents,
      { chunkSize: options.chunkSize ?? DEFAULT_CHUNK_SIZE, overlap: options.overlap ?? DEFAULT_CHUNK_OVERLAP },
    );

    await store.deleteKnowledgeRetrievalSegmentsForSource(ctx.organizationId, sourceId);

    if (passages.length === 0) {
      await store.updateKnowledgeSourceIndexingState(ctx.organizationId, sourceId, "ready");
      return { sourceId, chunkCount: 0, ready: true };
    }

    const byok = accessMode === "byok";
    const output = await embedder.embed(passages.map((p) => p.content), { byok });

    // Record the embedding cost as usage (Sprint 016 capture; BYOK → 0).
    await store.createLlmUsageEvent({
      organizationId: ctx.organizationId,
      providerSlug: embedder.providerSlug as ProviderSlug,
      modelId: embedder.modelId,
      taskType: "embedding",
      inputTokens: output.inputTokens,
      outputTokens: 0,
      costUsd: byok ? 0 : output.costUsd,
      byok,
      status: "success",
      createdByUserId: ctx.userId,
    });

    const inputs: CreateKnowledgeRetrievalSegmentInput[] = passages.map((p, i) => ({
      ...p,
      embedding: output.vectors[i] ?? null,
      embeddingModelId: embedder.modelId,
      embeddingDim: embedder.dim,
    }));
    await store.createKnowledgeRetrievalSegments(inputs);

    await store.updateKnowledgeSourceIndexingState(ctx.organizationId, sourceId, "ready");
    await store.createAuditEvent({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      action: "knowledge.indexed",
      targetType: "knowledge_source",
      targetId: sourceId,
      metadata: { chunkCount: inputs.length, embeddingModelId: embedder.modelId, byok },
    });
    return { sourceId, chunkCount: inputs.length, ready: true };
  } catch (err) {
    await store.updateKnowledgeSourceIndexingState(ctx.organizationId, sourceId, "failed");
    throw err;
  }
}

/**
 * Embed all of an organization's sources (idempotent; safe to re-run). Records a
 * usage-cost event per source, respecting access mode. Used by the backfill.
 */
export async function backfillOrganization(
  store: DataStore,
  embedder: Embedder,
  ctx: KnowledgeContext,
  options: IndexOptions = {},
): Promise<IndexResult[]> {
  assertManage(ctx);
  const sources = await store.listKnowledgeSources(ctx.organizationId);
  const results: IndexResult[] = [];
  for (const source of sources) {
    if (source.status === "archived") continue;
    results.push(await indexKnowledgeSource(store, embedder, ctx, source.id, options));
  }
  return results;
}
