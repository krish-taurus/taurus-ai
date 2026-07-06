-- ===========================================================================
-- Taurus AI — Knowledge Vault foundation (Prompt 006)
--
-- The initial schema (0001_init.sql) created placeholder knowledge_sources and
-- knowledge_chunks tables that application code never used. knowledge_chunks was
-- for future retrieval (an embedding column) which is out of scope for this
-- sprint, so it is dropped; a later prompt re-introduces it. knowledge_sources
-- is replaced with the real, organization-scoped model below.
-- ===========================================================================

drop table if exists knowledge_chunks cascade;
drop table if exists knowledge_sources cascade;

-- A knowledge source: a document, note, or website record an organization adds
-- to its vault. source_type in (file, text, url).
create table knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  source_type text not null,                 -- file | text | url
  status text not null default 'draft',      -- draft | uploaded | processing | ready | failed | archived
  visibility text not null default 'organization', -- private | organization
  created_by_user_id uuid references users(id),
  archived_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A stored document belonging to a knowledge source. text_content holds the
-- extracted text for simple text formats; pdf/docx store metadata only for now.
create table knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  knowledge_source_id uuid not null references knowledge_sources(id) on delete cascade,
  title text not null,
  original_filename text,
  content_type text,
  byte_size integer,
  checksum_sha256 text,
  storage_key text,
  text_content text,
  text_preview text,
  extraction_status text not null default 'not_required', -- not_required | pending | extracted | failed | unsupported
  extraction_error text,
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Assignment of a knowledge source to an AI Employee (many-to-many, org-scoped).
create table employee_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references ai_employees(id) on delete cascade,
  knowledge_source_id uuid not null references knowledge_sources(id) on delete cascade,
  assigned_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  unique (employee_id, knowledge_source_id)
);

-- Indexes ------------------------------------------------------------------
create index idx_knowledge_sources_org on knowledge_sources (organization_id);
create index idx_knowledge_sources_org_status on knowledge_sources (organization_id, status);
create index idx_knowledge_documents_org on knowledge_documents (organization_id);
create index idx_knowledge_documents_source on knowledge_documents (knowledge_source_id);
create index idx_employee_knowledge_org on employee_knowledge_sources (organization_id);
create index idx_employee_knowledge_employee on employee_knowledge_sources (employee_id);
create index idx_employee_knowledge_source on employee_knowledge_sources (knowledge_source_id);
