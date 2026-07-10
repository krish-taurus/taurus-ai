-- ===========================================================================
-- Taurus AI — Workflows (Sprint 048, Phase 1)
--
-- A workflow chains AI Employees together: a trigger starts a run, each node's
-- output feeds the next (Triage -> Refunds -> notify). The definition (nodes +
-- connections) and the trigger are stored as JSON, exactly like n8n stores a
-- workflow. Runs and their steps are a durable, inspectable ledger — modeled on
-- channel_webhook_events (status transitions, org-scoped, metadata-only).
--
-- Phase 1 executes runs inline within the triggering request; the run/step
-- tables are already shaped for durable resume (a later phase advances a
-- `running` run via a tick), so no schema change is needed to add that.
-- Vector-free, secret-free: node output is model text the org already sees.
-- ===========================================================================

-- The workflow definition.
create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft',          -- draft | active | paused | archived
  trigger jsonb not null default '{"type":"manual"}'::jsonb,
  graph jsonb not null default '{"entryNodeId":null,"nodes":[]}'::jsonb,
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workflows_org on workflows (organization_id);
create index if not exists idx_workflows_org_status on workflows (organization_id, status);
create index if not exists idx_workflows_created_by_user_id on workflows (created_by_user_id);

-- One execution of a workflow.
create table if not exists workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  workflow_id uuid not null references workflows(id) on delete cascade,
  status text not null default 'running',         -- running | succeeded | failed | canceled
  triggered_by text not null default 'manual',    -- manual | channel | schedule | webhook | workflow
  input jsonb not null default '{}'::jsonb,
  output text,
  error text,
  step_count integer not null default 0,
  created_by_user_id uuid references users(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_workflow_runs_workflow on workflow_runs (workflow_id, started_at desc);
create index if not exists idx_workflow_runs_org on workflow_runs (organization_id);
create index if not exists idx_workflow_runs_created_by_user_id on workflow_runs (created_by_user_id);

-- Each executed node in a run (the checkpoint ledger).
create table if not exists workflow_run_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  run_id uuid not null references workflow_runs(id) on delete cascade,
  node_id text not null,
  node_type text not null,                        -- trigger | employee | condition | transform
  employee_id uuid references ai_employees(id) on delete set null,
  sequence integer not null,
  status text not null,                           -- succeeded | failed | skipped
  input text,
  output text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_workflow_run_steps_run on workflow_run_steps (run_id, sequence);
create index if not exists idx_workflow_run_steps_org on workflow_run_steps (organization_id);
create index if not exists idx_workflow_run_steps_employee_id on workflow_run_steps (employee_id);
-- One row per node per run position — makes advancing a run idempotent.
create unique index if not exists idx_workflow_run_steps_run_seq
  on workflow_run_steps (run_id, sequence);
