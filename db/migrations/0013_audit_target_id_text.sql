-- Migration 0013: audit_events.target_id -> text (BYOK save hotfix).
--
-- Audit target ids are natural keys and are NOT always UUIDs. Model Hub BYOK and
-- messaging credential events record the provider by its slug (e.g. "openai",
-- "anthropic", "twilio"), not a UUID. The column was uuid, so saving a provider
-- credential raised:
--   invalid input syntax for type uuid: "openai"
-- when the follow-up audit event was written.
--
-- Widen target_id to text. Existing uuid values cast losslessly, and the
-- application layer has always treated target_id as a string
-- (AuditEventInput.targetId: string | null). No data is lost and no other column
-- changes are needed — the organization_provider_credentials table already stores
-- provider_slug as text.

alter table audit_events
  alter column target_id type text using target_id::text;
