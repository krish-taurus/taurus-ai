/**
 * Knowledge preparation (Prompt 007) — server only.
 *
 * Turns the extracted text of Knowledge Vault sources into internal searchable
 * excerpts (segments). PDFs/DOCX without extracted text are skipped (no full
 * parsing this sprint). Deterministic + testable; no external calls.
 *
 * User-facing language is "prepare knowledge" / "excerpts" — never "chunks".
 */

import type {
  CreateKnowledgeRetrievalSegmentInput,
  KnowledgeDocument,
  KnowledgeSource,
} from "@/lib/db/types";
import type { DataStore } from "@/lib/db/store";
import { EXCERPT_PREVIEW_CHARS, SEGMENT_MAX_CHARS } from "@/modules/employee-chat/metadata";

/** Collapse whitespace and trim. */
function tidy(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function makePreview(text: string, max = EXCERPT_PREVIEW_CHARS): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

/**
 * Split text into deterministic segments of roughly SEGMENT_MAX_CHARS, breaking
 * on paragraph boundaries and never mid-word. Pure + deterministic.
 */
export function splitIntoSegments(text: string, maxChars = SEGMENT_MAX_CHARS): string[] {
  const clean = tidy(text);
  if (!clean) return [];

  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const segments: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) segments.push(current.trim());
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      // Split an oversized paragraph on sentence boundaries.
      flush();
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if ((current + " " + sentence).trim().length > maxChars) flush();
        current = current ? `${current} ${sentence}` : sentence;
      }
      flush();
      continue;
    }
    if ((current + "\n\n" + paragraph).trim().length > maxChars) flush();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  flush();
  return segments;
}

/** A document is chat-ready only when it has usable extracted text. */
export function isDocumentChatReady(doc: KnowledgeDocument): boolean {
  return (
    !!doc.textContent &&
    doc.textContent.trim().length > 0 &&
    doc.extractionStatus !== "unsupported" &&
    doc.extractionStatus !== "failed"
  );
}

/** Build segment inputs for one source from its chat-ready documents. */
export function buildSegmentInputs(
  source: KnowledgeSource,
  documents: KnowledgeDocument[],
): CreateKnowledgeRetrievalSegmentInput[] {
  const inputs: CreateKnowledgeRetrievalSegmentInput[] = [];
  let index = 0;
  for (const doc of documents) {
    if (!isDocumentChatReady(doc)) continue;
    const pieces = splitIntoSegments(doc.textContent ?? "");
    for (const piece of pieces) {
      inputs.push({
        organizationId: source.organizationId,
        knowledgeSourceId: source.id,
        knowledgeDocumentId: doc.id,
        title: source.name,
        content: piece,
        contentPreview: makePreview(piece),
        segmentIndex: index,
        metadata: {
          sourceName: source.name,
          sourceType: source.sourceType,
          documentTitle: doc.title,
        },
      });
      index += 1;
    }
  }
  return inputs;
}

export interface PrepareResult {
  sourceId: string;
  segmentCount: number;
  ready: boolean;
}

/**
 * Rebuild retrieval segments for one source: drop existing, recreate from current
 * extracted text. Returns how many excerpts were produced.
 */
export async function rebuildKnowledgeRetrievalSegmentsForSource(
  store: DataStore,
  organizationId: string,
  sourceId: string,
): Promise<PrepareResult> {
  const source = await store.getKnowledgeSource(organizationId, sourceId);
  if (!source || source.status === "archived") {
    await store.deleteKnowledgeRetrievalSegmentsForSource(organizationId, sourceId);
    return { sourceId, segmentCount: 0, ready: false };
  }
  const documents = await store.listKnowledgeDocumentsForSource(organizationId, sourceId);
  const inputs = buildSegmentInputs(source, documents);

  await store.deleteKnowledgeRetrievalSegmentsForSource(organizationId, sourceId);
  if (inputs.length > 0) await store.createKnowledgeRetrievalSegments(inputs);

  return { sourceId, segmentCount: inputs.length, ready: inputs.length > 0 };
}

export interface PrepareEmployeeResult {
  preparedSources: number;
  totalSegments: number;
  results: PrepareResult[];
}

/** Rebuild segments for every non-archived source assigned to an employee. */
export async function rebuildKnowledgeRetrievalSegmentsForEmployee(
  store: DataStore,
  organizationId: string,
  employeeId: string,
): Promise<PrepareEmployeeResult> {
  const sources = await store.listKnowledgeSourcesForEmployee(organizationId, employeeId);
  const results: PrepareResult[] = [];
  for (const source of sources) {
    if (source.status === "archived") continue;
    results.push(
      await rebuildKnowledgeRetrievalSegmentsForSource(store, organizationId, source.id),
    );
  }
  return {
    preparedSources: results.filter((r) => r.ready).length,
    totalSegments: results.reduce((sum, r) => sum + r.segmentCount, 0),
    results,
  };
}
