import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import {
  createOpenAiEmbedder,
  resolveEmbedder,
  OPENAI_EMBED_MODEL_ID,
  OPENAI_EMBED_DIM,
} from "@/modules/knowledge/embedder-resolver";
import { LOCAL_EMBED_MODEL_ID, LOCAL_EMBED_DIM } from "@/modules/knowledge/embeddings";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createOpenAiEmbedder", () => {
  it("posts to the embeddings endpoint and returns vectors ordered by index", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          // Intentionally out of order to prove we sort by index.
          data: [
            { index: 1, embedding: [0.4, 0.5, 0.6] },
            { index: 0, embedding: [0.1, 0.2, 0.3] },
          ],
          usage: { prompt_tokens: 42 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const embedder = createOpenAiEmbedder({ apiKey: "sk-test", dim: 3 });
    const out = await embedder.embed(["first", "second"], { byok: false });

    expect(out.vectors).toEqual([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);
    expect(out.inputTokens).toBe(42);
    expect(out.costUsd).toBeCloseTo((42 / 1_000_000) * 0.02, 12);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe("https://api.openai.com/v1/embeddings");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sk-test");
  });

  it("charges nothing under BYOK and short-circuits empty input", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const embedder = createOpenAiEmbedder({ apiKey: "sk-test" });

    const empty = await embedder.embed([], { byok: false });
    expect(empty).toEqual({ vectors: [], inputTokens: 0, costUsd: 0 });
    expect(fetchMock).not.toHaveBeenCalled();

    expect(embedder.modelId).toBe(OPENAI_EMBED_MODEL_ID);
    expect(embedder.dim).toBe(OPENAI_EMBED_DIM);
    expect(embedder.providerSlug).toBe("openai");
  });

  it("throws with the status when the provider rejects the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 })),
    );
    const embedder = createOpenAiEmbedder({ apiKey: "sk-bad" });
    await expect(embedder.embed(["x"], { byok: false })).rejects.toThrow(/401/);
  });
});

describe("resolveEmbedder", () => {
  const ORG = "org-embed-test";

  it("falls back to the local embedder when no OpenAI key is configured", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const store = new InMemoryStore();
      const embedder = await resolveEmbedder(store, ORG);
      expect(embedder.modelId).toBe(LOCAL_EMBED_MODEL_ID);
      expect(embedder.dim).toBe(LOCAL_EMBED_DIM);
    } finally {
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
    }
  });

  it("uses the real OpenAI embedder when a platform key is present", async () => {
    const prev = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-platform";
    try {
      const store = new InMemoryStore();
      const embedder = await resolveEmbedder(store, ORG);
      expect(embedder.modelId).toBe(OPENAI_EMBED_MODEL_ID);
      expect(embedder.dim).toBe(OPENAI_EMBED_DIM);
      expect(embedder.providerSlug).toBe("openai");
    } finally {
      if (prev === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prev;
    }
  });
});
