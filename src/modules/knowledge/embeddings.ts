/**
 * Embeddings for semantic retrieval (Sprint 019) — pure + provider-agnostic.
 *
 * Chunks Knowledge Vault text into overlapping passages and turns them into
 * vectors via an injected `Embedder` port (no provider SDK here). A deterministic
 * local embedder is provided as the zero-setup default; a Model-Hub-backed
 * embedder can be dropped in without changing callers.
 */

import type { CostTier } from "@/modules/usage/model-pricing";
import type { ProviderSlug } from "@/lib/db/types";

// --- Chunking ----------------------------------------------------------------

export interface ChunkOptions {
  /** Target passage size in ~tokens (word-approximated). Default 800. */
  chunkSize?: number;
  /** Overlap between consecutive passages in ~tokens. Default 100. */
  overlap?: number;
}

export const DEFAULT_CHUNK_SIZE = 800;
export const DEFAULT_CHUNK_OVERLAP = 100;
export const DEFAULT_TOP_K = 5;

/**
 * Split text into overlapping passages of ~`chunkSize` tokens with ~`overlap`
 * token overlap, preserving order. Deterministic and pure. Tokens are
 * word-approximated (whitespace split), which is stable and dependency-free.
 */
export function chunkPassages(text: string, options: ChunkOptions = {}): string[] {
  const chunkSize = Math.max(1, options.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const overlap = Math.max(0, Math.min(options.overlap ?? DEFAULT_CHUNK_OVERLAP, chunkSize - 1));
  const step = Math.max(1, chunkSize - overlap);

  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= chunkSize) return [words.join(" ")];

  const passages: string[] = [];
  for (let start = 0; start < words.length; start += step) {
    passages.push(words.slice(start, start + chunkSize).join(" "));
    if (start + chunkSize >= words.length) break;
  }
  return passages;
}

// --- Embedder port -----------------------------------------------------------

export interface EmbedOutput {
  vectors: number[][];
  /** Approximate input tokens across all texts (for the usage-cost event). */
  inputTokens: number;
  /** Serving cost to Taurus for this call. 0 for BYOK / a free local model. */
  costUsd: number;
}

/**
 * The grading mechanism for knowledge → vectors. Exposes its model + tier up
 * front so the caller can enforce access mode (frontier is BYOK-only in managed
 * mode) before spending anything.
 */
export interface Embedder {
  readonly modelId: string;
  readonly providerSlug: ProviderSlug;
  readonly dim: number;
  readonly costTier: CostTier;
  embed(texts: string[], opts: { byok: boolean }): Promise<EmbedOutput>;
}

// --- Local (default) embedder ------------------------------------------------

/** FNV-1a hash of a token → a bucket in [0, dim). Deterministic. */
function hashToken(token: string, dim: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % dim;
}

/** L2-normalize a vector in place, returning it. */
export function normalizeVector(vec: number[]): number[] {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

/** Deterministic bag-of-words hashing embedding. Free, no network, dev/default. */
export function localEmbed(text: string, dim: number): number[] {
  const vec = new Array<number>(dim).fill(0);
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").split(/\s+/).filter(Boolean);
  for (const token of tokens) vec[hashToken(token, dim)] += 1;
  return normalizeVector(vec);
}

export const LOCAL_EMBED_MODEL_ID = "taurus-local-embed-v1";
export const LOCAL_EMBED_DIM = 256;

/**
 * The zero-setup default embedder: a deterministic local model. Free (cost 0),
 * budget tier, no customer key. Semantic-lite (bag-of-words) — enough to retrieve
 * differently-worded passages in dev without any provider configuration.
 */
export function createLocalEmbedder(dim: number = LOCAL_EMBED_DIM): Embedder {
  return {
    modelId: LOCAL_EMBED_MODEL_ID,
    providerSlug: "custom_openai_compatible",
    dim,
    costTier: "budget",
    async embed(texts) {
      const vectors = texts.map((t) => localEmbed(t, dim));
      const inputTokens = texts.reduce((s, t) => s + t.split(/\s+/).filter(Boolean).length, 0);
      return { vectors, inputTokens, costUsd: 0 };
    },
  };
}

// --- Similarity --------------------------------------------------------------

/** Cosine similarity of two equal-length vectors, clamped to [0, 1]. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  const sim = dot / (Math.sqrt(na) * Math.sqrt(nb));
  return Math.max(0, Math.min(1, sim));
}
