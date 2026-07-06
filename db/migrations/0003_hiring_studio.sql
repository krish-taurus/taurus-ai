-- ===========================================================================
-- Taurus AI — Hiring Studio support (Prompt 004)
--
-- Adds two minimal fields to ai_employees captured during the guided hiring
-- flow: the employee's main responsibilities (a list) and their working style
-- (tone / formality / risk level / escalation preference). Both are simple
-- structured JSON, matching the project's existing jsonb conventions. This is
-- intentionally NOT a full Employee DNA system.
-- ===========================================================================

alter table ai_employees
  add column if not exists responsibilities jsonb not null default '[]'::jsonb,
  add column if not exists working_style jsonb;
