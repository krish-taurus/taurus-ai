-- ===========================================================================
-- Taurus AI — Channels + Website Widget foundation (Prompt 008)
--
-- The first external deployment layer for AI Employees. A "channel" links an
-- Employee to an outside surface. This sprint fully implements the Web channels
-- (hosted chat page, iframe embed, website widget, public API — one channel, one
-- public key). Messaging / Voice / Workplace channels are reserved as foundation
-- (types + provider_config) and are not runnable yet.
--
-- Privacy: no full IP addresses are stored — only hashes. provider_config holds
-- non-secret configuration only; real credentials are never stored here.
-- ===========================================================================

create table if not exists employee_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references ai_employees(id) on delete cascade,
  channel_type text not null,                 -- hosted_chat | website_widget | iframe_embed | public_api | whatsapp | sms | email | phone_call | slack | microsoft_teams | instagram_dm | facebook_messenger | telegram
  channel_provider text not null default 'taurus_web', -- taurus_web | twilio | meta_whatsapp_cloud | telnyx | vonage | sendgrid | mailgun | slack | microsoft_graph | telegram | custom_webhook
  public_key text not null unique,
  secret_hash text,
  name text not null,
  status text not null default 'draft',       -- draft | active | paused | archived
  allowed_domains jsonb not null default '[]'::jsonb,
  appearance jsonb not null default '{}'::jsonb,
  provider_config jsonb not null default '{}'::jsonb,  -- NON-SECRET config only
  welcome_message text,
  rate_limit_per_minute integer not null default 20,
  rate_limit_per_day integer not null default 500,
  created_by_user_id uuid references users(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Anonymous visitor sessions. Each session maps to one isolated chat thread so
-- visitors never see each other's conversations.
create table if not exists public_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references ai_employees(id) on delete cascade,
  channel_id uuid not null references employee_channels(id) on delete cascade,
  thread_id uuid references employee_chat_threads(id) on delete set null,
  visitor_id text not null,
  visitor_label text,
  origin_domain text,
  user_agent_hash text,
  ip_hash text,
  status text not null default 'active',       -- active | archived | blocked
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

-- Metadata-only channel events (never message contents).
create table if not exists public_channel_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid references ai_employees(id) on delete set null,
  channel_id uuid references employee_channels(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes -------------------------------------------------------------------
create index if not exists idx_channels_org on employee_channels (organization_id);
create index if not exists idx_channels_employee on employee_channels (employee_id);
create index if not exists idx_channels_org_employee on employee_channels (organization_id, employee_id, status);
create unique index if not exists idx_channels_public_key on employee_channels (public_key);

create index if not exists idx_public_sessions_org on public_chat_sessions (organization_id);
create index if not exists idx_public_sessions_employee on public_chat_sessions (employee_id);
create index if not exists idx_public_sessions_channel on public_chat_sessions (channel_id);
create index if not exists idx_public_sessions_visitor on public_chat_sessions (channel_id, visitor_id);

create index if not exists idx_channel_events_org on public_channel_events (organization_id);
create index if not exists idx_channel_events_employee on public_channel_events (employee_id);
create index if not exists idx_channel_events_channel on public_channel_events (channel_id);
create index if not exists idx_channel_events_created on public_channel_events (organization_id, created_at desc);
