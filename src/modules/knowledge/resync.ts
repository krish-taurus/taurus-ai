/**
 * Headless connector re-sync (Sprint 053) — server only.
 *
 * Re-fetches a knowledge source's content from its external connector and
 * re-indexes it, WITHOUT a dashboard session — so a scheduled workflow can pull
 * the latest data on its own and the AI Employee retrains on it. This is the
 * "extract from a data source on a schedule" half of the vision.
 *
 * DATABASE sources are supported now (decrypt the connection + run the saved
 * query). Google Drive / SharePoint / cloud storage re-fetch (OAuth refresh +
 * provider APIs) are a follow-up; they raise a clear message rather than fail
 * silently. `file` / `text` / `url` sources have no external data to pull.
 */

import type { DataStore } from "@/lib/db/store";
import type { KnowledgeSource, DocumentExtractionStatus } from "@/lib/db/types";
import type { Embedder } from "@/modules/knowledge/embeddings";
import { indexKnowledgeSource, type KnowledgeContext } from "@/modules/knowledge/indexing";
import { syncDatabaseSource } from "@/modules/knowledge/service";
import { runDatabaseQuery } from "@/modules/knowledge/connectors/database";
import { decryptApiKey, isEncryptionConfigured } from "@/modules/model-gateway/credentials";

export class ResyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResyncError";
  }
}

export interface FetchedContent {
  text: string | null;
  status: DocumentExtractionStatus;
  rowCount: number;
}

/** Pulls fresh content for a source from its connector (injectable for tests). */
export type SourceContentFetcher = (source: KnowledgeSource) => Promise<FetchedContent>;

/** Default database fetcher: decrypt the stored connection and run the saved query. */
export async function fetchDatabaseContent(source: KnowledgeSource): Promise<FetchedContent> {
  const meta = source.metadata as {
    kind?: "postgres" | "mysql";
    query?: string;
    connectionEncrypted?: string;
  };
  if (!meta.connectionEncrypted || !meta.query) {
    throw new ResyncError("This source is missing its connection details.");
  }
  if (!isEncryptionConfigured()) {
    throw new ResyncError("Secure storage is not configured, so connector sync is disabled.");
  }
  const connectionString = await decryptApiKey(meta.connectionEncrypted);
  const result = await runDatabaseQuery({
    kind: meta.kind ?? "postgres",
    connectionString,
    query: meta.query,
  });
  return { text: result.text, status: result.status, rowCount: result.rowCount };
}

export interface ResyncResult {
  sourceType: KnowledgeSource["sourceType"];
  rowCount: number;
  chunkCount: number;
  ready: boolean;
}

/**
 * Re-fetch a source from its connector and re-index it. Returns row + chunk
 * counts. Throws `ResyncError` (with a readable message) for unsupported source
 * types or missing config.
 */
export async function resyncKnowledgeSource(
  store: DataStore,
  ctx: KnowledgeContext,
  sourceId: string,
  embedder: Embedder,
  fetcher: SourceContentFetcher = fetchDatabaseContent,
): Promise<ResyncResult> {
  const source = await store.getKnowledgeSource(ctx.organizationId, sourceId);
  if (!source || source.status === "archived") {
    throw new ResyncError("This knowledge source could not be found.");
  }
  if (source.sourceType !== "database") {
    if (source.sourceType === "file" || source.sourceType === "text" || source.sourceType === "url") {
      throw new ResyncError(
        `A ${source.sourceType} source has no external data to pull. Use Refresh knowledge to re-index it.`,
      );
    }
    throw new ResyncError(
      `Automatic sync for ${source.sourceType} sources isn't available in workflows yet — sync it from the Knowledge Vault.`,
    );
  }

  const content = await fetcher(source);
  await syncDatabaseSource(store, { organizationId: ctx.organizationId, userId: ctx.userId }, sourceId, {
    text: content.text,
    status: content.status,
    rowCount: content.rowCount,
  });
  const indexResult = await indexKnowledgeSource(store, embedder, ctx, sourceId);
  return {
    sourceType: source.sourceType,
    rowCount: content.rowCount,
    chunkCount: indexResult.chunkCount,
    ready: indexResult.ready,
  };
}
