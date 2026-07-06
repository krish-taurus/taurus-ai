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
import type { ChatSourceReference, KnowledgeSourceType } from "@/lib/db/types";
import { MAX_RETRIEVED_EXCERPTS } from "@/modules/employee-chat/metadata";

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

/**
 * Retrieve the top excerpts for a question from an employee's assigned knowledge.
 */
export async function retrieveForEmployee(
  store: DataStore,
  params: { organizationId: string; employeeId: string; query: string; limit?: number },
): Promise<RetrievalResult> {
  const limit = params.limit ?? MAX_RETRIEVED_EXCERPTS;
  const ranked = await store.searchKnowledgeRetrievalSegments(
    params.organizationId,
    params.employeeId,
    params.query,
    limit,
  );

  const excerpts: RetrievedExcerpt[] = ranked.map(({ segment, score }) => {
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
  });

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
