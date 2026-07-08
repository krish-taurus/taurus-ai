/**
 * Employee Chat runtime constants + friendly labels (Prompt 007).
 *
 * Business-friendly language only — the UI never says "chunk", "vector",
 * "embedding", "RAG", "prompt", "LLM", or "agent".
 */

import type { KnowledgeSourceType } from "@/lib/db/types";

/** Max prior messages included as conversation history (safety limit). */
export const MAX_HISTORY_MESSAGES = 10;

/** Max excerpts retrieved and shown as sources. */
export const MAX_RETRIEVED_EXCERPTS = 5;

/** Target size of a prepared knowledge segment, in characters. */
export const SEGMENT_MAX_CHARS = 1200;

/** Preview length for source cards. */
export const EXCERPT_PREVIEW_CHARS = 280;

/** Friendly, non-technical labels for source types (source/document/website). */
export const SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  text: "Note",
  file: "Document",
  url: "Website",
  database: "Database",
};

/** Why chat is blocked, if it is — drives the readiness UI + CTAs. */
export type ChatBlockReason = "needs_dna" | "needs_model_hub" | "archived" | "no_model";

/** Friendly assistant text shown when a provider call fails. */
export const FRIENDLY_ERROR_MESSAGE =
  "Sorry — I couldn't complete that just now. Please try again in a moment.";
