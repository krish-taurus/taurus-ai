-- ===========================================================================
-- Taurus AI — Real embeddings model support (Sprint 045)
--
-- The zero-setup local embedder produces 256-dim vectors; a provider-backed
-- model (e.g. OpenAI text-embedding-3-small) produces 1536-dim. pgvector
-- columns are FIXED-dimension, so a `vector(256)` column could never store the
-- real model's output. This widens the embedding column to a DIMENSIONLESS
-- `vector` so any model's output fits, and drops the fixed-dimension HNSW index
-- (an ANN index requires a fixed dimension).
--
-- Retrieval only compares vectors of the SAME dimension (see embedding_dim),
-- so a re-embed that mixes 256- and 1536-dim rows is safe: mismatched rows are
-- filtered out before any distance is computed, never compared and never
-- erroring. Knowledge vaults are tenant-scoped and small, so the scan that
-- replaces the ANN index is acceptable.
-- ===========================================================================

-- The ANN index is bound to the old fixed dimension — drop it before widening.
drop index if exists idx_krs_embedding_hnsw;

-- Widen vector(256) -> vector (any dimension). The cast is a metadata-only
-- typmod change (no re-encoding of stored vectors).
alter table knowledge_retrieval_segments
  alter column embedding type vector using embedding::vector;
