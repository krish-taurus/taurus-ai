-- ===========================================================================
-- Taurus AI — Development seed data (optional)
-- Creates one demo user, one demo organization, and an owner membership.
-- Safe to run repeatedly (idempotent via fixed UUIDs + on conflict do nothing).
-- Do NOT run against production. This is local demo data only.
-- ===========================================================================

insert into users (id, email, full_name)
values ('00000000-0000-0000-0000-000000000001', 'founder@demo.taurus.ai', 'Demo Founder')
on conflict (id) do nothing;

insert into organizations (id, name, slug, industry, size_range)
values ('00000000-0000-0000-0000-0000000000a1', 'Demo Organization', 'demo-organization', 'Software', '1-10')
on conflict (id) do nothing;

insert into organization_members (id, organization_id, user_id, role, status)
values (
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-000000000001',
  'owner',
  'active'
)
on conflict (organization_id, user_id) do nothing;

insert into audit_events (organization_id, actor_type, actor_id, action, target_type, target_id, metadata)
values (
  '00000000-0000-0000-0000-0000000000a1',
  'user',
  '00000000-0000-0000-0000-000000000001',
  'organization.created',
  'organization',
  '00000000-0000-0000-0000-0000000000a1',
  '{"seeded": true}'
);

-- A sample AI Employee so the dashboard is not empty on a fresh seed.
insert into ai_employees
  (id, organization_id, name, role_title, department, description, status, visibility,
   responsibilities, working_style, created_by)
values (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000a1',
  'Maya',
  'Customer Support AI',
  'Support',
  'Answers common customer support questions for the demo organization.',
  'active',
  'organization',
  '["Answer common support questions", "Help customers resolve issues", "Escalate complex problems to a human"]'::jsonb,
  '{"tone": "friendly", "formality": "balanced", "riskLevel": "conservative", "escalation": "ask_when_unsure"}'::jsonb,
  '00000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;
