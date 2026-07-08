-- ===========================================================================
-- Taurus AI — Embeddings & Semantic Retrieval (Sprint 019)
--
-- Adds embedding vectors to the existing retrieval chunk table
-- (knowledge_retrieval_segments) so chat retrieval can be HYBRID: semantic
-- (vector) + the existing lexical signal. Chunks are already deleted/recreated
-- when a source changes, so no orphans. Everything stays organization-scoped.
--
-- The DB is pgvector-ready. We store the embedding + its model id + dimension so
-- a later model change can trigger a re-embed rather than mixing vector spaces.
-- Vector rows hold source-derived text + numbers only — no secrets.
-- ===========================================================================

-- pgvector extension (no-op if already present).
create extension if not exists vector;

-- Embedding columns on the chunk table. Dimension is fixed for the index; the
-- default embedding model produces 256-dim vectors. embedding_model_id +
-- embedding_dim let a backfill detect and re-embed when the model changes.
alter table knowledge_retrieval_segments add column if not exists embedding vector(256);
alter table knowledge_retrieval_segments add column if not exists embedding_model_id text;
alter table knowledge_retrieval_segments add column if not exists embedding_dim integer;

-- Approximate-nearest-neighbour index for cosine similarity (HNSW). Scoped
-- queries still filter by organization_id first (leading index below).
create index if not exists idx_krs_embedding_hnsw
  on knowledge_retrieval_segments using hnsw (embedding vector_cosine_ops);
-- Tenant-scoped lookups lead with organization_id.
create index if not exists idx_krs_org
  on knowledge_retrieval_segments (organization_id);

-- Per-source indexing state so a manager knows when a source is searchable.
alter table knowledge_sources add column if not exists indexing_state text not null default 'pending';
