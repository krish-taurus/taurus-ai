-- ===========================================================================
-- Taurus AI — AI Employee support (Prompt 003)
--
-- The ai_employees table itself is defined in 0001_init.sql. This migration adds
-- an index that supports the Employee list query, which orders an organization's
-- employees by most-recently-updated.
-- ===========================================================================

create index if not exists idx_employees_org_updated
  on ai_employees (organization_id, updated_at desc);
