-- ===========================================================================
-- Taurus AI — Performance Review / Evaluation (Sprint 018)
--
-- Lets a manager score an AI Employee against real situations and watch quality
-- improve as they refine the DNA. A Growth+ feature (gated in code by the plan's
-- performanceReview flag). Every table leads with organization_id and every
-- child FK is org-scoped so a child can never reference another org's parent.
--
-- Only what's needed to show the manager is stored on results (the Employee's
-- output + per-criterion scores). No secrets; events are metadata-safe.
-- ===========================================================================

-- The set of weighted criteria an Employee is measured on.
create table if not exists performance_scorecard (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_performance_scorecard_org
  on performance_scorecard (organization_id);

-- One graded dimension. Org-scoped FK to its scorecard (composite reference).
create table if not exists performance_criterion (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scorecard_id uuid not null references performance_scorecard(id) on delete cascade,
  label text not null,
  guidance text not null default '',
  method text not null,                       -- contains | exact | regex | no_refusal | reviewer | grounded
  expected text,
  weight numeric not null default 1,
  pass_threshold numeric not null default 0.7,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_performance_criterion_org
  on performance_criterion (organization_id);
create index if not exists idx_performance_criterion_scorecard
  on performance_criterion (organization_id, scorecard_id);

-- A real situation (input + definition of good).
create table if not exists performance_review_case (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scorecard_id uuid not null references performance_scorecard(id) on delete cascade,
  name text not null,
  situation text not null,
  expected text,
  created_at timestamptz not null default now()
);
create index if not exists idx_performance_case_org
  on performance_review_case (organization_id);
create index if not exists idx_performance_case_scorecard
  on performance_review_case (organization_id, scorecard_id);

-- One execution of a scorecard against a pinned Employee DNA version.
create table if not exists performance_review_run (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scorecard_id uuid not null references performance_scorecard(id) on delete cascade,
  employee_id uuid not null references ai_employees(id) on delete cascade,
  dna_version_id uuid not null,
  dna_version_number integer not null,
  status text not null default 'pending',     -- pending | running | completed | failed
  overall_score numeric,
  passed_cases integer not null default 0,
  total_cases integer not null default 0,
  error text,
  started_by_user_id uuid references users(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_performance_run_org
  on performance_review_run (organization_id);
create index if not exists idx_performance_run_employee
  on performance_review_run (organization_id, employee_id, started_at);

-- The graded output for one case within a run.
create table if not exists performance_review_result (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  run_id uuid not null references performance_review_run(id) on delete cascade,
  case_id uuid not null references performance_review_case(id) on delete cascade,
  employee_output text not null default '',
  passed boolean not null default false,
  score numeric not null default 0,
  criterion_scores jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_performance_result_org
  on performance_review_result (organization_id);
create index if not exists idx_performance_result_run
  on performance_review_result (organization_id, run_id);
