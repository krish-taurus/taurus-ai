/**
 * Backfill embeddings for a single organization (Sprint 019).
 *
 * Usage:  npx tsx scripts/backfill-embeddings.ts <organizationId> [ownerUserId]
 *
 * Idempotent and safe to re-run: each source is chunked + re-embedded (existing
 * chunks are dropped and recreated). Uses the zero-setup local embedder; indexing
 * enforces the org's model access mode and records usage-cost like any managed
 * model call. The real work lives in `backfillOrganization` (tested).
 */

import { getStore } from "@/lib/db/store";
import { createLocalEmbedder } from "@/modules/knowledge/embeddings";
import { backfillOrganization } from "@/modules/knowledge/indexing";

async function main() {
  const organizationId = process.argv[2];
  const userId = process.argv[3] ?? "system-backfill";
  if (!organizationId) {
    console.error("Usage: npx tsx scripts/backfill-embeddings.ts <organizationId> [ownerUserId]");
    process.exit(1);
  }
  const store = getStore();
  const results = await backfillOrganization(
    store,
    createLocalEmbedder(),
    { organizationId, userId, role: "owner" },
  );
  const ready = results.filter((r) => r.ready).length;
  const chunks = results.reduce((s, r) => s + r.chunkCount, 0);
  console.log(`Backfill complete: ${ready}/${results.length} sources ready, ${chunks} chunks.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
