-- ===========================================================================
-- Taurus AI — Initial schema (Prompt 002: Database, Auth, and Tenancy)
-- Source of truth: 02_technical/002_database_schema.md
--
-- Tenancy rule: every tenant-scoped table carries organization_id and every
-- tenant-scoped query must validate active organization membership. Enforcement
-- lives in the application (src/lib/security). This file only defines structure.
-- ===========================================================================

-- Extensions -----------------------------------------------------------------
-- pgcrypto provides gen_random_uuid(); vector provides pgvector embeddings.
create extension if not exists pgcrypto;
create extension if not exists vector;

-- users ----------------------------------------------------------------------
-- Application-level user profile. Credentials are owned by the auth provider
-- (Supabase/Clerk-compatible); this table mirrors identity into Taurus.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- organizations --------------------------------------------------------------
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  industry text,
  website_url text,
  size_range text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- organization_members -------------------------------------------------------
-- The membership model: a user belongs to zero or more organizations, each with
-- a role. role in (owner, admin, builder, viewer). status in (active, invited,
-- suspended). A user may belong to multiple organizations.
create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'viewer',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- ai_employees ---------------------------------------------------------------
create table if not exists ai_employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  role_title text not null,
  department text,
  status text not null default 'draft',
  visibility text not null default 'private',
  description text,
  avatar_url text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- employee_dna_versions ------------------------------------------------------
create table if not exists employee_dna_versions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references ai_employees(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  version integer not null,
  role_purpose text,
  responsibilities jsonb not null default '[]',
  tone jsonb not null default '{}',
  personality jsonb not null default '{}',
  policies jsonb not null default '{}',
  allowed_skills jsonb not null default '[]',
  knowledge_scope jsonb not null default '{}',
  escalation_rules jsonb not null default '{}',
  model_preferences jsonb not null default '{}',
  is_active boolean not null default false,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (employee_id, version)
);

-- knowledge_sources ----------------------------------------------------------
create table if not exists knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid references ai_employees(id) on delete set null,
  source_type text not null,
  title text not null,
  uri text,
  storage_path text,
  status text not null default 'pending',
  error_message text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- knowledge_chunks -----------------------------------------------------------
create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid references ai_employees(id) on delete set null,
  knowledge_source_id uuid not null references knowledge_sources(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  metadata jsonb not null default '{}',
  embedding vector,
  created_at timestamptz not null default now()
);

-- conversations --------------------------------------------------------------
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references ai_employees(id) on delete cascade,
  user_id uuid references users(id),
  channel text not null default 'chat',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- messages -------------------------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid references ai_employees(id),
  sender_type text not null,
  sender_id uuid,
  content text not null,
  citations jsonb not null default '[]',
  confidence numeric,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- collaboration_requests -----------------------------------------------------
create table if not exists collaboration_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  requesting_employee_id uuid not null references ai_employees(id),
  responding_employee_id uuid not null references ai_employees(id),
  status text not null default 'pending',
  request_text text not null,
  response_text text,
  permission_snapshot jsonb not null default '{}',
  confidence numeric,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

-- audit_events ---------------------------------------------------------------
-- organization_id is nullable so platform-level events can be recorded too.
create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete set null,
  actor_type text not null,
  actor_id uuid,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- usage_events ---------------------------------------------------------------
create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid references ai_employees(id) on delete set null,
  event_type text not null,
  quantity numeric not null default 1,
  unit text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Indexes --------------------------------------------------------------------
create index if not exists idx_org_members_org on organization_members(organization_id);
create index if not exists idx_org_members_user on organization_members(user_id);
create index if not exists idx_employees_org on ai_employees(organization_id);
create index if not exists idx_dna_employee on employee_dna_versions(employee_id);
create index if not exists idx_sources_org_employee on knowledge_sources(organization_id, employee_id);
create index if not exists idx_chunks_org_employee on knowledge_chunks(organization_id, employee_id);
create index if not exists idx_conversations_org_employee on conversations(organization_id, employee_id);
create index if not exists idx_messages_conversation on messages(conversation_id);
create index if not exists idx_collab_org on collaboration_requests(organization_id);
create index if not exists idx_audit_org_created on audit_events(organization_id, created_at desc);
create index if not exists idx_usage_org_created on usage_events(organization_id, created_at desc);
