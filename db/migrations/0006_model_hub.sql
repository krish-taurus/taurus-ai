-- ===========================================================================
-- Taurus AI — Model Hub + LLM Gateway foundation (Prompt 006B)
--
-- Provider-agnostic model configuration. The model *catalog* is authoritative in
-- code (src/modules/model-gateway/catalog.ts) so it cannot drift; the
-- ai_model_providers / ai_models tables are the persistent mirror for a future
-- admin-managed catalog. The per-organization tables below hold real dynamic
-- data (settings, credentials, usage). API keys are stored ENCRYPTED only.
-- ===========================================================================

-- Provider catalog (seeded below; code catalog is authoritative for now).
create table if not exists ai_model_providers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  provider_type text not null,               -- openai | anthropic | google | openai_compatible
  status text not null default 'available',  -- available | disabled
  default_base_url text,
  supports_platform_key boolean not null default true,
  supports_byok boolean not null default true,
  documentation_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_models (
  id uuid primary key default gen_random_uuid(),
  provider_slug text not null,
  model_id text not null,
  display_name text not null,
  model_family text,
  status text not null default 'available',
  model_tier text not null,                  -- economy | balanced | premium | realtime | private_open | coding | reasoning
  recommended_for text,
  context_window_tokens integer,
  max_output_tokens integer,
  supports_text boolean not null default true,
  supports_vision boolean not null default false,
  supports_audio boolean not null default false,
  supports_tools boolean not null default false,
  supports_json boolean not null default false,
  supports_streaming boolean not null default false,
  supports_reasoning boolean not null default false,
  supports_caching boolean not null default false,
  input_usd_per_million_tokens numeric,
  cached_input_usd_per_million_tokens numeric,
  output_usd_per_million_tokens numeric,
  pricing_notes text,
  pricing_source_url text,
  price_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_slug, model_id)
);

-- Organization-level default model configuration (one row per organization).
create table if not exists organization_model_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  default_model_id text,
  routing_mode text not null default 'auto_balanced', -- auto_balanced | cost_optimized | quality_first | privacy_first | provider_locked | manual
  allowed_provider_slugs jsonb not null default '[]'::jsonb,
  blocked_provider_slugs jsonb not null default '[]'::jsonb,
  monthly_budget_usd numeric,
  budget_alert_threshold_percent integer,
  fallback_model_id text,
  updated_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Employee-level model override (one row per employee).
create table if not exists employee_model_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null unique references ai_employees(id) on delete cascade,
  model_id text,
  routing_mode text,
  max_monthly_budget_usd numeric,
  fallback_model_id text,
  updated_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Provider credentials. API keys are stored ENCRYPTED; plaintext is never stored
-- and the encrypted value is never returned to the client (only key_last_four).
create table if not exists organization_provider_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider_slug text not null,
  credential_mode text not null default 'taurus_managed', -- taurus_managed | bring_your_own_key | disabled
  encrypted_api_key text,
  key_last_four text,
  status text not null default 'active',     -- active | disabled | error
  created_by_user_id uuid references users(id),
  updated_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider_slug)
);

-- Usage events. NEVER stores message contents — only token counts + metadata.
create table if not exists llm_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid references ai_employees(id) on delete set null,
  provider_slug text not null,
  model_id text not null,
  task_type text not null,
  input_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric,
  latency_ms integer,
  status text not null default 'success',    -- success | error | blocked
  error_code text,
  request_id_hash text,
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now()
);

-- Indexes -------------------------------------------------------------------
create index if not exists idx_ai_models_provider on ai_models (provider_slug);
create index if not exists idx_org_model_settings_org on organization_model_settings (organization_id);
create index if not exists idx_employee_model_settings_org on employee_model_settings (organization_id);
create index if not exists idx_employee_model_settings_employee on employee_model_settings (employee_id);
create index if not exists idx_provider_credentials_org on organization_provider_credentials (organization_id);
create index if not exists idx_llm_usage_org_created on llm_usage_events (organization_id, created_at desc);
create index if not exists idx_llm_usage_employee on llm_usage_events (employee_id);

-- Seed providers (the model catalog is defined in code for this sprint).
insert into ai_model_providers (slug, display_name, provider_type, supports_platform_key, supports_byok, default_base_url, documentation_url)
values
  ('openai', 'OpenAI', 'openai', true, true, 'https://api.openai.com/v1', 'https://platform.openai.com/docs'),
  ('anthropic', 'Anthropic', 'anthropic', true, true, 'https://api.anthropic.com/v1', 'https://docs.anthropic.com'),
  ('deepseek', 'DeepSeek', 'openai_compatible', true, true, 'https://api.deepseek.com/v1', 'https://api-docs.deepseek.com'),
  ('moonshot_kimi', 'Moonshot Kimi', 'openai_compatible', true, true, 'https://api.moonshot.ai/v1', 'https://platform.moonshot.ai/docs'),
  ('groq', 'Groq', 'openai_compatible', true, true, 'https://api.groq.com/openai/v1', 'https://console.groq.com/docs'),
  ('google_gemini', 'Google Gemini', 'google', true, true, 'https://generativelanguage.googleapis.com/v1beta', 'https://ai.google.dev/docs'),
  ('fireworks', 'Fireworks', 'openai_compatible', true, true, 'https://api.fireworks.ai/inference/v1', 'https://docs.fireworks.ai'),
  ('custom_openai_compatible', 'Custom (OpenAI-compatible)', 'openai_compatible', false, true, null, null)
on conflict (slug) do nothing;
