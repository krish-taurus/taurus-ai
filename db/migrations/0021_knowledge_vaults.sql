-- ===========================================================================
-- Taurus AI — Multiple Knowledge Vaults (Sprint 028)
--
-- Adds an organizing layer on top of knowledge sources: a "vault" is a named
-- collection of sources within an organization (a folder). Every source belongs
-- to exactly one vault. Existing sources are migrated into a per-org default
-- "General" vault so nothing changes for current data.
--
-- This migration is organizational only — it does not change how sources are
-- assigned to employees or how retrieval works (a later change assigns whole
-- vaults to employees).
-- ===========================================================================

-- A vault: a named collection of knowledge sources, scoped to an organization.
create table if not exists knowledge_vaults (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean not null default false,   -- the auto "General" vault
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_vaults_org on knowledge_vaults (organization_id);
create index if not exists idx_knowledge_vaults_created_by_user_id on knowledge_vaults (created_by_user_id);
-- One default vault per organization.
create unique index if not exists uq_knowledge_vaults_org_default
  on knowledge_vaults (organization_id) where is_default;

-- Each source belongs to a vault. Nullable while we backfill; sources cannot be
-- orphaned by deleting a vault (restrict — the app reassigns to the default first).
alter table knowledge_sources
  add column if not exists vault_id uuid references knowledge_vaults(id) on delete restrict;

create index if not exists idx_knowledge_sources_vault on knowledge_sources (vault_id);

-- Backfill: give every organization that already has sources a default "General"
-- vault, then file all of its existing sources into it.
insert into knowledge_vaults (organization_id, name, is_default)
select distinct s.organization_id, 'General', true
from knowledge_sources s
where not exists (
  select 1 from knowledge_vaults v
  where v.organization_id = s.organization_id and v.is_default
);

update knowledge_sources s
set vault_id = v.id
from knowledge_vaults v
where v.organization_id = s.organization_id
  and v.is_default
  and s.vault_id is null;
