-- ===========================================================================
-- Taurus AI — Employee DNA versioning (Prompt 005)
--
-- The initial schema (0001_init.sql) created a placeholder employee_dna_versions
-- table that application code never used. This migration replaces it with the
-- versioned Employee DNA model: each employee has many DNA versions, at most one
-- draft and one published at a time (enforced by partial unique indexes).
-- ===========================================================================

drop table if exists employee_dna_versions cascade;

create table employee_dna_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references ai_employees(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft',       -- draft | published | archived
  schema_version text not null default '1.0',
  dna jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references users(id),
  published_by_user_id uuid references users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, version_number)
);

-- Indexes for common access patterns.
create index idx_dna_org on employee_dna_versions (organization_id);
create index idx_dna_employee on employee_dna_versions (employee_id);
create index idx_dna_status on employee_dna_versions (status);
create index idx_dna_employee_version on employee_dna_versions (employee_id, version_number);

-- Each employee may have at most one draft and one published DNA at a time.
create unique index uniq_dna_one_draft
  on employee_dna_versions (employee_id) where status = 'draft';
create unique index uniq_dna_one_published
  on employee_dna_versions (employee_id) where status = 'published';
