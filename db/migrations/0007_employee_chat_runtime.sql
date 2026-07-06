-- ===========================================================================
-- Taurus AI — Employee Chat Runtime with Knowledge Vault grounding (Prompt 007)
--
-- Lets a user test/chat with an AI Employee. Answers are grounded in the
-- employee's published Employee DNA and the Knowledge Vault sources assigned to
-- it. Retrieval uses internal "segments" (never called "chunks" in the UI).
--
-- Privacy: chat message contents live ONLY in employee_chat_messages. Audit and
-- retrieval-event rows store metadata only — never full messages, never model
-- instructions, never raw provider responses, never keys.
-- ===========================================================================

-- Conversation threads (one active thread per employee is typical).
create table if not exists employee_chat_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references ai_employees(id) on delete cascade,
  title text,
  status text not null default 'active',       -- active | archived
  created_by_user_id uuid references users(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Individual messages. Stores only safe metadata alongside the visible content.
create table if not exists employee_chat_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  thread_id uuid not null references employee_chat_threads(id) on delete cascade,
  employee_id uuid not null references ai_employees(id) on delete cascade,
  role text not null,                          -- user | assistant | system
  content text not null,
  status text not null default 'sent',         -- sent | pending | failed
  source_references jsonb,                      -- [{sourceId,name,sourceType,documentId,preview}]
  model_provider_slug text,
  model_id text,
  model_tier text,
  routing_mode text,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric,
  latency_ms integer,
  error_code text,
  brain_mode text,                              -- live | local_demo
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now()
);

-- Internal searchable excerpts of prepared knowledge (NOT user-facing "chunks").
create table if not exists knowledge_retrieval_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  knowledge_source_id uuid not null references knowledge_sources(id) on delete cascade,
  knowledge_document_id uuid references knowledge_documents(id) on delete cascade,
  title text not null,
  content text not null,
  content_preview text not null,
  segment_index integer not null default 0,
  status text not null default 'ready',        -- ready | archived
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Metadata-only record of a retrieval. Stores a HASH of the query, never the
-- full question (that lives as a chat message already).
create table if not exists employee_chat_retrieval_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references ai_employees(id) on delete cascade,
  thread_id uuid references employee_chat_threads(id) on delete cascade,
  message_id uuid references employee_chat_messages(id) on delete set null,
  query_text_hash text,
  retrieved_source_count integer not null default 0,
  top_source_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes -------------------------------------------------------------------
create index if not exists idx_chat_threads_org on employee_chat_threads (organization_id);
create index if not exists idx_chat_threads_employee on employee_chat_threads (employee_id);
create index if not exists idx_chat_threads_org_employee on employee_chat_threads (organization_id, employee_id, status);
create index if not exists idx_chat_messages_org on employee_chat_messages (organization_id);
create index if not exists idx_chat_messages_thread on employee_chat_messages (thread_id, created_at);
create index if not exists idx_chat_messages_employee on employee_chat_messages (employee_id);
create index if not exists idx_retrieval_segments_org on knowledge_retrieval_segments (organization_id);
create index if not exists idx_retrieval_segments_source on knowledge_retrieval_segments (knowledge_source_id);
create index if not exists idx_retrieval_segments_document on knowledge_retrieval_segments (knowledge_document_id);
create index if not exists idx_retrieval_events_org on employee_chat_retrieval_events (organization_id);
create index if not exists idx_retrieval_events_employee on employee_chat_retrieval_events (employee_id);
create index if not exists idx_retrieval_events_thread on employee_chat_retrieval_events (thread_id);
