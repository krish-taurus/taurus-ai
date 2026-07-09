-- ===========================================================================
-- Taurus AI — Marketplace seller payouts (Sprint 035)
--
-- Closes the money loop from Sprint 034: a seller connects a payout account
-- (Stripe Connect / Razorpay Route — KYC handled by the provider) and withdraws
-- their accrued revenue-share balance. Balance is derived, not stored:
--   available(currency) = Σ seller_net of PAID payments in that currency
--                       − Σ amount of non-failed payouts in that currency
--
-- SAFETY: money only moves when live provider keys are configured. With no keys
-- the simulated provider marks onboarding active and settles withdrawals
-- in-process (no network, no transfer). Bank details never touch Taurus — they
-- live with the provider; we store only the opaque connected-account id.
-- ===========================================================================

-- One payout account per organization (the destination for its earnings).
create table if not exists marketplace_payout_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null,                       -- stripe | razorpay | simulated
  external_account_id text,                     -- Connect/Route account id (opaque)
  status text not null default 'onboarding',    -- onboarding | active | restricted
  created_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id)
);

create index if not exists idx_marketplace_payout_accounts_extid
  on marketplace_payout_accounts (external_account_id)
  where external_account_id is not null;

-- A withdrawal of accrued balance to the org's payout account.
create table if not exists marketplace_payouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null,                       -- stripe | razorpay | simulated
  external_account_id text,                     -- destination connected account
  external_transfer_id text,                    -- provider transfer/payout id
  -- Opaque reference WE generate and hand to the provider (reconciliation key).
  reference text not null unique,
  amount integer not null,                      -- minor units, > 0
  currency text not null,
  status text not null default 'pending',       -- pending | paid | failed
  created_by_user_id uuid references users(id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marketplace_payouts_org on marketplace_payouts (organization_id);
create index if not exists idx_marketplace_payouts_created_by_user_id on marketplace_payouts (created_by_user_id);
create unique index if not exists idx_marketplace_payouts_provider_transferid
  on marketplace_payouts (provider, external_transfer_id)
  where external_transfer_id is not null;
