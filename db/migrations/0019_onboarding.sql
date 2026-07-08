-- Sprint 020 — Onboarding activation state.
--
-- The first-run activation checklist derives step completion (hired Employees,
-- published DNA, Knowledge Vault sources, chat tests, live web channels) from
-- existing data. This table only persists the two bits that cannot be derived:
-- whether the organization dismissed the checklist (resumable), and when it
-- first became fully complete (so the milestone is audited exactly once).
--
-- Org-scoped: the organization id is the primary key (one row per org), which
-- is also the leading — and only — lookup key.

create table if not exists organization_onboarding (
  organization_id uuid primary key references organizations (id) on delete cascade,
  dismissed_at timestamptz,
  completed_at timestamptz,
  updated_by_user_id uuid references users (id) on delete set null,
  updated_at timestamptz not null default now()
);
