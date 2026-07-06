-- ===========================================================================
-- Taurus AI — Messaging Channels foundation (Prompt 009)
--
-- Extends the Prompt 008 channel architecture to WhatsApp / SMS / Email. Reuses
-- employee_channels for the channel record and public_chat_sessions +
-- employee_chat_messages for conversations, so messaging runs through the same
-- Employee Chat Runtime (Model Gateway only) as web channels.
--
-- Privacy/security: provider credentials are stored ENCRYPTED only; webhook
-- events store metadata only (never raw payloads or secrets); contacts are keyed
-- by a salted hash, never a raw phone/email.
-- ===========================================================================

-- Encrypted provider credentials (one row per organization + provider).
create table if not exists channel_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider_type text not null,               -- twilio | meta_whatsapp_cloud | sendgrid | mailgun | custom_webhook
  credential_mode text not null default 'disabled', -- bring_your_own_key | taurus_managed | disabled
  encrypted_credentials text,                 -- NEVER plaintext; NEVER returned to the client
  credential_label text,
  key_last_four text,
  status text not null default 'disabled',   -- active | disabled | error
  created_by_user_id uuid references users(id),
  updated_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider_type)
);

-- Metadata-only webhook lifecycle events (never full raw payloads / secrets).
create table if not exists channel_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  channel_id uuid references employee_channels(id) on delete set null,
  provider_type text not null,
  event_type text not null,                  -- inbound | delivery_status | verification | ignored | error
  external_event_id text,
  status text not null default 'received',   -- received | processed | failed | ignored
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now()
);

-- Messaging template metadata foundation (no submission/approval workflow).
create table if not exists messaging_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel_id uuid references employee_channels(id) on delete set null,
  provider_type text not null,
  template_name text not null,
  template_category text not null default 'utility',
  language text not null default 'en',
  status text not null default 'draft',      -- draft | active | disabled
  external_template_id text,
  body_preview text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compliance foundation: opt-in / block status per contact (hashed identifier).
create table if not exists messaging_contact_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel_id uuid not null references employee_channels(id) on delete cascade,
  external_contact_id text,                  -- optional; prefer the hash below
  normalized_contact_hash text not null,
  channel_type text not null,
  opt_in_status text not null default 'unknown', -- unknown | opted_in | opted_out | blocked
  blocked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, normalized_contact_hash)
);

-- Indexes -------------------------------------------------------------------
create index if not exists idx_provider_creds_org on channel_provider_credentials (organization_id);
create index if not exists idx_webhook_events_org on channel_webhook_events (organization_id);
create index if not exists idx_webhook_events_channel on channel_webhook_events (channel_id, received_at desc);
create index if not exists idx_messaging_templates_org on messaging_templates (organization_id);
create index if not exists idx_messaging_templates_channel on messaging_templates (channel_id);
create index if not exists idx_contact_prefs_org on messaging_contact_preferences (organization_id);
create index if not exists idx_contact_prefs_channel on messaging_contact_preferences (channel_id);
