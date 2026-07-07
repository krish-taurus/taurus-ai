-- Migration 0012: BYOK provider credential details (Sprint 013).
--
-- Extends organization_provider_credentials with an optional custom base URL
-- (required for the Custom OpenAI-compatible provider, which has no default
-- endpoint) and an optional human label. Neither is secret; the encrypted API
-- key remains the only sensitive column and is never returned to the client.

alter table organization_provider_credentials
  add column if not exists base_url text,
  add column if not exists label text;
