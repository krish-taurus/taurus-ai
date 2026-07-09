-- ===========================================================================
-- Taurus AI — Inter-company AI Employee marketplace (Sprint 030)
--
-- An organization can publish an AI Employee as a public "listing" (a resume:
-- its DNA + a performance summary, and optionally descriptions of the vaults it
-- uses). Other organizations browse the marketplace and "hire" the agent, which
-- CLONES its DNA into the hirer's org as a new employee — the seller's knowledge
-- vault is never shared.
--
-- SECURITY: a listing is a self-contained SNAPSHOT (dna/performance/vault
-- descriptions captured at publish time). The public marketplace reads only the
-- listing row, never the seller's live private tables, so nothing outside the
-- snapshot can leak across organizations. The DNA snapshot has its org-specific
-- companyContext blanked before it is stored.
-- ===========================================================================

create table if not exists marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references ai_employees(id) on delete cascade,
  public_key text not null unique,
  title text not null,
  headline text,
  summary text,
  role_title text,
  status text not null default 'draft',        -- draft | published | unpublished
  include_vaults boolean not null default false,
  dna_version_number integer,
  dna_snapshot jsonb not null default '{}'::jsonb,
  performance_snapshot jsonb not null default '{}'::jsonb,
  vault_snapshot jsonb not null default '[]'::jsonb,
  hire_count integer not null default 0,
  created_by_user_id uuid references users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One listing per employee; republishing updates it in place.
  unique (employee_id)
);

create index if not exists idx_marketplace_listings_org on marketplace_listings (organization_id);
create index if not exists idx_marketplace_listings_status on marketplace_listings (status);
create index if not exists idx_marketplace_listings_created_by_user_id on marketplace_listings (created_by_user_id);

-- A hire request: an org asks to hire a listed agent; the owner approves, which
-- clones the DNA into the hirer's org (hirer_employee_id) — recorded here.
create table if not exists marketplace_hires (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references marketplace_listings(id) on delete cascade,
  listing_organization_id uuid not null references organizations(id) on delete cascade,
  hirer_organization_id uuid not null references organizations(id) on delete cascade,
  hirer_employee_id uuid references ai_employees(id) on delete set null,
  status text not null default 'requested',     -- requested | approved | declined
  note text,
  requested_by_user_id uuid references users(id),
  decided_by_user_id uuid references users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_marketplace_hires_listing on marketplace_hires (listing_id);
create index if not exists idx_marketplace_hires_listing_org on marketplace_hires (listing_organization_id);
create index if not exists idx_marketplace_hires_hirer_org on marketplace_hires (hirer_organization_id);
create index if not exists idx_marketplace_hires_hirer_employee_id on marketplace_hires (hirer_employee_id);
create index if not exists idx_marketplace_hires_requested_by_user_id on marketplace_hires (requested_by_user_id);
create index if not exists idx_marketplace_hires_decided_by_user_id on marketplace_hires (decided_by_user_id);
