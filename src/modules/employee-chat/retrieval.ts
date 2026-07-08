/**
 * Knowledge retrieval for chat (Prompt 007) — server only.
 *
 * Finds the most relevant prepared excerpts for a question, restricted to the
 * Knowledge Vault sources ASSIGNED to the selected employee (the store join
 * enforces: assigned + non-archived + same organization + ready segments). Uses
 * deterministic lexical scoring — no embeddings, no vectors, no external calls.
 *
 * The result is business-friendly ("sources"/"excerpts"); scores stay internal.
 */

import type { DataStore } from "@/lib/db/store";
import type {
  ChatSourceReference,
  KnowledgeRetrievalSegment,
  KnowledgeSourceType,
} from "@/lib/db/types";
import { MAX_RETRIEVED_EXCERPTS } from "@/modules/employee-chat/metadata";
import { createLocalEmbedder, DEFAULT_TOP_K, type Embedder } from "@/modules/knowledge/embeddings";

export interface RetrievedExcerpt {
  sourceId: string;
  documentId: string | null;
  name: string;
  sourceType: KnowledgeSourceType;
  preview: string;
  content: string;
  /** Internal relevance score — never shown to end users. */
  score: number;
}

export interface RetrievalResult {
  excerpts: RetrievedExcerpt[];
  /** Distinct source ids that contributed, best first. */
  topSourceIds: string[];
}

function asSourceType(value: unknown): KnowledgeSourceType {
  return value === "file" || value === "url" ? value : "text";
}

function toExcerpt(segment: KnowledgeRetrievalSegment, score: number): RetrievedExcerpt {
  const meta = segment.metadata as { sourceName?: string; sourceType?: string };
  return {
    sourceId: segment.knowledgeSourceId,
    documentId: segment.knowledgeDocumentId,
    name: meta.sourceName ?? segment.title,
    sourceType: asSourceType(meta.sourceType),
    preview: segment.contentPreview,
    content: segment.content,
    score,
  };
}

export interface RetrieveOptions {
  organizationId: string;
  employeeId: string;
  query: string;
  limit?: number;
  /** Embedder for the semantic signal; defaults to the local model (matches the
   * default indexing embedder). Must match the model the chunks were embedded with. */
  embedder?: Embedder;
}

/**
 * HYBRID retrieval (Sprint 019): semantic top-k (vector) merged with the existing
 * lexical signal, deduped by segment. Strictly org- + assignment-scoped by the
 * store queries — never across orgs. Falls back to lexical-only if nothing is
 * embedded yet (graceful) — the grounded-answer contract is unchanged.
 */
export async function retrieveForEmployee(
  store: DataStore,
  params: RetrieveOptions,
): Promise<RetrievalResult> {
  const limit = params.limit ?? MAX_RETRIEVED_EXCERPTS;
  const pool = Math.max(limit, DEFAULT_TOP_K) * 2;
  const embedder = params.embedder ?? createLocalEmbedder();

  const lexical = await store.searchKnowledgeRetrievalSegments(
    params.organizationId,
    params.employeeId,
    params.query,
    pool,
  );

  let semantic: Awaited<ReturnType<DataStore["semanticSearchKnowledgeRetrievalSegments"]>> = [];
  try {
    const { vectors } = await embedder.embed([params.query], { byok: false });
    if (vectors[0]) {
      semantic = await store.semanticSearchKnowledgeRetrievalSegments(
        params.organizationId,
        params.employeeId,
        vectors[0],
        pool,
      );
    }
  } catch {
    // Semantic is best-effort; lexical still grounds the answer.
  }

  // Merge + dedupe by segment id. Lexical scores are normalized to 0–1 and
  // combined with the cosine similarity so a hit in both ranks highest.
  const maxLex = lexical.reduce((m, r) => Math.max(m, r.score), 0) || 1;
  const combined = new Map<string, { segment: KnowledgeRetrievalSegment; score: number }>();
  for (const r of lexical) {
    combined.set(r.segment.id, { segment: r.segment, score: 0.5 * (r.score / maxLex) });
  }
  for (const r of semantic) {
    const existing = combined.get(r.segment.id);
    if (existing) existing.score += 0.5 * r.similarity;
    else combined.set(r.segment.id, { segment: r.segment, score: 0.5 * r.similarity });
  }

  const ranked = [...combined.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.segment.segmentIndex !== b.segment.segmentIndex) {
      return a.segment.segmentIndex - b.segment.segmentIndex;
    }
    return a.segment.id.localeCompare(b.segment.id);
  });

  const excerpts = ranked.slice(0, limit).map((r) => toExcerpt(r.segment, r.score));
  const topSourceIds: string[] = [];
  for (const e of excerpts) {
    if (!topSourceIds.includes(e.sourceId)) topSourceIds.push(e.sourceId);
  }
  return { excerpts, topSourceIds };
}

/** Map excerpts to the safe, UI-facing source references stored on a message. */
export function toSourceReferences(excerpts: RetrievedExcerpt[]): ChatSourceReference[] {
  // One card per distinct source (first, highest-scoring excerpt wins).
  const seen = new Set<string>();
  const refs: ChatSourceReference[] = [];
  for (const e of excerpts) {
    if (seen.has(e.sourceId)) continue;
    seen.add(e.sourceId);
    refs.push({
      sourceId: e.sourceId,
      name: e.name,
      sourceType: e.sourceType,
      documentId: e.documentId,
      preview: e.preview,
    });
  }
  return refs;
}
