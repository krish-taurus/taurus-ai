-- ===========================================================================
-- Taurus AI — Usage & Limits + Cost/Margin tracking (Sprint 016)
--
-- Builds on llm_usage_events (Prompt 006B) and billing (Sprint 015). Adds the
-- fields needed to measure SERVING COST and MARGIN from real usage, plus a
-- per-organization MODEL ACCESS MODE (managed vs. bring-your-own-key).
--
-- Model token prices remain AUTHORITATIVE IN CODE (the Model Hub catalog +
-- src/modules/usage/model-pricing.ts). We store a PRICE SNAPSHOT per event so a
-- historical cost stays accurate even after catalog prices change. Usage events
-- remain metadata only — never message contents, never card data.
-- ===========================================================================

-- Cost snapshot + access metadata on every usage event.
--   cost_usd          : serving cost to Taurus for this interaction (0 for BYOK).
--   unit_input_price  : $ / 1M input tokens used at write time (snapshot).
--   unit_output_price : $ / 1M output tokens used at write time (snapshot).
--   byok              : true when the interaction ran on the customer's own key
--                       (customer bears the token cost; cost_usd is 0 to Taurus).
--   channel_type      : the deployment channel the interaction came through, so
--                       usage can be broken down by channel (web / messaging /
--                       voice). Nullable for interactions with no channel context.
alter table llm_usage_events add column if not exists cost_usd numeric;
alter table llm_usage_events add column if not exists unit_input_price numeric;
alter table llm_usage_events add column if not exists unit_output_price numeric;
alter table llm_usage_events add column if not exists byok boolean not null default false;
alter table llm_usage_events add column if not exists channel_type text;

-- Tenant-scoped period queries (usage dashboard) already have
-- idx_llm_usage_org_created (organization_id, created_at desc) from 0006.
-- The operator margin aggregate is cross-tenant over a period, so index
-- created_at on its own. It is ONLY ever queried behind the platform-operator
-- gate (never from a tenant route).
create index if not exists idx_llm_usage_created on llm_usage_events (created_at desc);

-- Per-organization model access mode. Defaults to 'managed' (zero-setup: runs on
-- Taurus keys, Taurus bears token cost, margin = subscription + token spread).
-- 'byok' runs on the customer's own key (cost_usd 0 to Taurus, ~100% margin).
-- Changeable by owner/admin only (enforced server-side); every change is audited.
alter table organizations add column if not exists model_access_mode text not null default 'managed';
