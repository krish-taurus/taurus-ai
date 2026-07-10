/**
 * Provider-backed embedder + resolver (Sprint 045) — SERVER ONLY.
 *
 * Wires a real embeddings model into the RAG pipeline. When an organization has
 * a usable OpenAI credential (its own BYOK key or a platform OPENAI_API_KEY),
 * knowledge is embedded with `text-embedding-3-small` (1536-dim, genuinely
 * semantic) instead of the zero-setup local bag-of-words model. When no key is
 * configured this falls back to the local embedder, so nothing breaks without
 * provider setup — the pipeline just stays semantic-lite.
 *
 * Each stored vector records the model dimension, and retrieval only compares
 * vectors of the SAME dimension. Switching models therefore never mixes vector
 * spaces or errors — existing sources are simply re-embedded (via "Prepare
 * knowledge" or the backfill script) and mismatched rows are ignored until then.
 */

import type { DataStore } from "@/lib/db/store";
import type { Embedder, EmbedOutput } from "@/modules/knowledge/embeddings";
import { createLocalEmbedder } from "@/modules/knowledge/embeddings";
import { createDefaultCredentialResolver } from "@/modules/model-gateway/credential-resolver";

/** OpenAI text-embedding-3-small: 1536-dim, ~$0.02 per 1M input tokens (budget). */
export const OPENAI_EMBED_MODEL_ID = "text-embedding-3-small";
export const OPENAI_EMBED_DIM = 1536;
const OPENAI_EMBED_USD_PER_1M = 0.02;

interface OpenAiEmbedderOptions {
  apiKey: string;
  /** OpenAI-compatible base URL; defaults to the public OpenAI endpoint. */
  baseUrl?: string | null;
  modelId?: string;
  dim?: number;
}

interface OpenAiEmbeddingsResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { prompt_tokens?: number; total_tokens?: number };
}

/**
 * A provider-backed embedder using the OpenAI embeddings API (also works with
 * any OpenAI-compatible endpoint via `baseUrl`). Dependency-free (plain fetch).
 * Reports input tokens + serving cost so indexing records usage like any other
 * managed model call; cost is 0 under BYOK.
 */
export function createOpenAiEmbedder(options: OpenAiEmbedderOptions): Embedder {
  const baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const modelId = options.modelId ?? OPENAI_EMBED_MODEL_ID;
  const dim = options.dim ?? OPENAI_EMBED_DIM;
  return {
    modelId,
    providerSlug: "openai",
    dim,
    costTier: "budget",
    async embed(texts: string[], opts: { byok: boolean }): Promise<EmbedOutput> {
      if (texts.length === 0) return { vectors: [], inputTokens: 0, costUsd: 0 };
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({ model: modelId, input: texts }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Embedding request failed (${res.status}): ${detail.slice(0, 200)}`);
      }
      const json = (await res.json()) as OpenAiEmbeddingsResponse;
      // Order by index so vectors line up with the input texts regardless of
      // the response ordering.
      const vectors = json.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
      const inputTokens =
        json.usage?.prompt_tokens ??
        json.usage?.total_tokens ??
        texts.reduce((sum, t) => sum + t.split(/\s+/).filter(Boolean).length, 0);
      const costUsd = opts.byok ? 0 : (inputTokens / 1_000_000) * OPENAI_EMBED_USD_PER_1M;
      return { vectors, inputTokens, costUsd };
    },
  };
}

/**
 * Pick the embedder for an organization: the real provider-backed model when a
 * usable OpenAI credential resolves (BYOK or a platform key), else the zero-setup
 * local model. Routing through the SAME credential resolver as chat means both
 * BYOK and Taurus-managed keys light it up with no extra configuration, and no
 * key at all keeps the local default — the pipeline never hard-fails on setup.
 */
export async function resolveEmbedder(
  store: DataStore,
  organizationId: string,
): Promise<Embedder> {
  const resolve = createDefaultCredentialResolver(store);
  const credential = await resolve(organizationId, "openai");
  if (credential?.apiKey) {
    return createOpenAiEmbedder({ apiKey: credential.apiKey, baseUrl: credential.baseUrl });
  }
  return createLocalEmbedder();
}
