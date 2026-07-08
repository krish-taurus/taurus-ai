-- ===========================================================================
-- Taurus AI — Metered Overage Billing, managed mode (Sprint 017)
--
-- Lets a MANAGED organization on pay-as-you-go continue past its interaction
-- quota instead of being hard-blocked, metering each further interaction at the
-- managed per-interaction price (Sprint 016). BYOK orgs are never metered for
-- tokens. No card data is stored — amounts + line items are metadata only.
--
-- Interaction COUNTS are always derived from llm_usage_events (never a parallel
-- counter); these tables/columns hold only the billing policy + the accrued
-- overage ledger.
-- ===========================================================================

-- Overage policy + optional spend cap live on the subscription (per-org billing
-- state). Defaults preserve current behavior: hard_cap, no cap.
alter table billing_subscriptions
  add column if not exists overage_policy text not null default 'hard_cap';   -- hard_cap | pay_as_you_go
alter table billing_subscriptions
  add column if not exists overage_spend_cap_usd numeric;                       -- null = no cap

-- One metered overage line per interaction past quota (managed pay-as-you-go).
-- period_start ties the line to the subscription period it belongs to. Amount is
-- quantity × the unit price snapshot, so a later catalog price change never
-- rewrites history. Simulated lines (provider='simulated') are accrued for
-- display but never charged.
create table if not exists billing_overage_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  period_start timestamptz not null,
  quantity integer not null default 1,
  unit_price_usd numeric not null,
  amount_usd numeric not null,
  status text not null default 'pending',        -- pending | reported | charged
  provider text not null,                         -- stripe | simulated
  external_usage_record_id text,                  -- opaque provider id once reported
  created_at timestamptz not null default now()
);

-- Tenant-scoped period queries lead with organization_id.
create index if not exists idx_billing_overage_org_period
  on billing_overage_items (organization_id, period_start);
-- Operator cross-tenant aggregate over a period (only behind the operator gate).
create index if not exists idx_billing_overage_created
  on billing_overage_items (created_at desc);
