-- ===========================================================================
-- Taurus AI — Workflow resume + new triggers (Sprint 050, Phase 2b)
--
-- Human-approval steps pause a run (status 'waiting') until someone approves or
-- rejects it. A paused run remembers WHERE it stopped so it can resume; the rest
-- of its state (each prior step's output) is rebuilt from the existing step
-- ledger, so only a resume cursor is needed here.
--
-- Schedule + channel triggers are stored in the existing trigger JSON, so they
-- need no new columns. Status values are free-text, so 'waiting' needs no change.
-- ===========================================================================

alter table workflow_runs
  add column if not exists cursor_node_id text;

-- Find due scheduled runs quickly (the tick scans across organizations).
create index if not exists idx_workflows_schedule_due
  on workflows ((trigger ->> 'nextRunAt'))
  where trigger ->> 'type' = 'schedule';
