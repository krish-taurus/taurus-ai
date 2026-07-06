-- ===========================================================================
-- Taurus AI — Voice Call Channel foundation (Prompt 010)
--
-- Lets an AI Employee eventually answer phone calls, reusing the Prompt 008/009
-- channel architecture: voice channels are employee_channels with
-- channel_type = 'phone_call' and a voice provider. Reasoning still runs through
-- the Employee Chat Runtime (Model Gateway only). This sprint fully implements a
-- SIMULATED call flow; real-time audio streaming is foundation only.
--
-- Privacy/security: caller numbers are stored as a salted hash (never raw), no
-- raw audio is stored, recordings are metadata-only, and provider secrets live in
-- the encrypted channel_provider_credentials table — never here.
-- ===========================================================================

create table if not exists voice_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel_id uuid not null references employee_channels(id) on delete cascade,
  provider_type text not null,               -- twilio_voice | telnyx_voice | vonage_voice | simulated_voice
  phone_number text not null,
  display_label text,
  external_phone_number_id text,
  country_code text,
  capabilities jsonb not null default '{}'::jsonb,
  status text not null default 'draft',       -- draft | active | paused | archived
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

-- One row per call. caller_hash is a salted hash; the raw number is never stored.
create table if not exists voice_call_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references ai_employees(id) on delete cascade,
  channel_id uuid not null references employee_channels(id) on delete cascade,
  phone_number_id uuid references voice_phone_numbers(id) on delete set null,
  provider_type text not null,
  external_call_id text,
  direction text not null default 'inbound',  -- inbound | outbound
  caller_hash text,
  caller_label text,
  status text not null default 'ringing',     -- ringing | active | completed | failed | missed | blocked
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  end_reason text,
  recording_status text not null default 'disabled', -- disabled | pending | available | failed
  transcript_status text not null default 'pending', -- pending | partial | completed | failed
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Transcript messages. This is the ONLY place transcript content is stored. Never
-- stores hidden model instructions or chain-of-thought.
create table if not exists voice_call_transcript_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references ai_employees(id) on delete cascade,
  channel_id uuid not null references employee_channels(id) on delete cascade,
  call_session_id uuid not null references voice_call_sessions(id) on delete cascade,
  speaker_type text not null,                 -- caller | employee | system
  content text not null,
  confidence numeric,
  started_at_ms integer,
  ended_at_ms integer,
  source_references jsonb,                      -- [{name,type,preview}] safe refs only
  model_provider_slug text,
  model_id text,
  estimated_cost_usd numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Metadata-only call lifecycle / stream events (never transcript content).
create table if not exists voice_stream_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  employee_id uuid references ai_employees(id) on delete set null,
  channel_id uuid references employee_channels(id) on delete set null,
  call_session_id uuid references voice_call_sessions(id) on delete cascade,
  provider_type text not null,
  event_type text not null,
  status text not null default 'ok',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes -------------------------------------------------------------------
create index if not exists idx_voice_numbers_org on voice_phone_numbers (organization_id);
create index if not exists idx_voice_numbers_channel on voice_phone_numbers (channel_id);
create index if not exists idx_voice_calls_org on voice_call_sessions (organization_id);
create index if not exists idx_voice_calls_channel on voice_call_sessions (channel_id, started_at desc);
create index if not exists idx_voice_calls_employee on voice_call_sessions (employee_id);
create index if not exists idx_voice_calls_external on voice_call_sessions (provider_type, external_call_id);
create index if not exists idx_voice_transcript_call on voice_call_transcript_messages (call_session_id, created_at);
create index if not exists idx_voice_transcript_org on voice_call_transcript_messages (organization_id);
create index if not exists idx_voice_events_call on voice_stream_events (call_session_id, created_at);
create index if not exists idx_voice_events_org on voice_stream_events (organization_id);
