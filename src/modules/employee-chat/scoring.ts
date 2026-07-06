/**
 * Deterministic lexical scoring for knowledge retrieval (Prompt 007).
 *
 * Pure, dependency-free (imports only types). No embeddings, no vectors, no
 * external calls — a simple, testable keyword scorer that can be swapped for
 * semantic retrieval later. This is internal: the UI never sees scores or the
 * word "chunk".
 */

import type { KnowledgeRetrievalSegment, RankedRetrievalSegment } from "@/lib/db/types";

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "is",
  "are",
  "was",
  "were",
  "be",
  "with",
  "as",
  "at",
  "by",
  "it",
  "this",
  "that",
  "what",
  "how",
  "do",
  "does",
  "can",
  "i",
  "you",
  "we",
  "our",
  "my",
  "me",
]);

/** Split a normalized string into meaningful terms (drops stop words). */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Score one segment against a query. Higher = more relevant.
 *   - +3 per query term found in the title
 *   - +1 per query term found in the content
 *   - +5 bonus when the whole normalized query appears as a phrase
 */
export function scoreSegment(
  queryTerms: string[],
  normalizedQuery: string,
  segment: KnowledgeRetrievalSegment,
): { score: number; matchedTerms: string[] } {
  const title = normalize(segment.title);
  const content = normalize(segment.content);
  const matched = new Set<string>();
  let score = 0;

  for (const term of queryTerms) {
    let hit = false;
    if (title.includes(term)) {
      score += 3;
      hit = true;
    }
    if (content.includes(term)) {
      score += 1;
      hit = true;
    }
    if (hit) matched.add(term);
  }

  if (normalizedQuery.length > 0 && content.includes(normalizedQuery)) {
    score += 5;
  }

  return { score, matchedTerms: [...matched] };
}

/**
 * Rank segments for a query and return the top `limit`, best first. Segments with
 * a zero score are dropped. Ties break by segment index then id for determinism.
 */
export function rankSegments(
  query: string,
  segments: KnowledgeRetrievalSegment[],
  limit = 5,
): RankedRetrievalSegment[] {
  const normalizedQuery = normalize(query);
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const scored: RankedRetrievalSegment[] = [];
  for (const segment of segments) {
    if (segment.status !== "ready") continue;
    const { score, matchedTerms } = scoreSegment(queryTerms, normalizedQuery, segment);
    if (score > 0) scored.push({ segment, score, matchedTerms });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.segment.segmentIndex !== b.segment.segmentIndex) {
      return a.segment.segmentIndex - b.segment.segmentIndex;
    }
    return a.segment.id.localeCompare(b.segment.id);
  });

  return scored.slice(0, Math.max(1, limit));
}
