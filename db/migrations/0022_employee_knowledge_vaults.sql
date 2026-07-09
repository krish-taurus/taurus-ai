-- ===========================================================================
-- Taurus AI — Assign whole vaults to employees (Sprint 029)
--
-- Employees are now given knowledge a vault at a time: assigning a vault grants
-- the employee every source in it (and anything added to that vault later). This
-- replaces per-source assignment as the live relationship used by retrieval.
--
-- Existing per-source assignments (employee_knowledge_sources) are migrated into
-- vault assignments: an employee who had any source from a vault is granted that
-- whole vault, so no employee loses access. The old table is left in place (not
-- dropped) so the migration is non-destructive.
-- ===========================================================================

create table if not exists employee_knowledge_vaults (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references ai_employees(id) on delete cascade,
  vault_id uuid not null references knowledge_vaults(id) on delete cascade,
  assigned_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  unique (employee_id, vault_id)
);

create index if not exists idx_employee_knowledge_vaults_org on employee_knowledge_vaults (organization_id);
create index if not exists idx_employee_knowledge_vaults_employee on employee_knowledge_vaults (employee_id);
create index if not exists idx_employee_knowledge_vaults_vault on employee_knowledge_vaults (vault_id);
create index if not exists idx_employee_knowledge_vaults_assigned_by_user_id on employee_knowledge_vaults (assigned_by_user_id);

-- Backfill: grant each employee the vaults of the sources they were assigned.
insert into employee_knowledge_vaults (organization_id, employee_id, vault_id, assigned_by_user_id)
select distinct eks.organization_id, eks.employee_id, s.vault_id, eks.assigned_by_user_id
from employee_knowledge_sources eks
join knowledge_sources s on s.id = eks.knowledge_source_id
where s.vault_id is not null
on conflict (employee_id, vault_id) do nothing;
