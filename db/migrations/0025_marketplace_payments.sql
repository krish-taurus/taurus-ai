-- ===========================================================================
-- Taurus AI — Marketplace paid lease / revenue-share (Sprint 034)
--
-- Sellers can put a one-time hire PRICE on a listing. A priced listing becomes
-- "buy-now": the buyer pays through a hosted checkout (Stripe or Razorpay) and,
-- on a verified `paid` webhook, the hire is auto-created and the DNA is cloned
-- into the buyer's org. Free listings keep the request → approve flow unchanged.
--
-- REVENUE-SHARE: every payment records a platform_fee + seller_net in minor
-- units (the revenue-share ledger). Actual disbursement to sellers (Stripe
-- Connect / Razorpay Route, which need seller KYC onboarding) is a follow-up —
-- v1 records what is owed and never auto-moves money to a third party.
--
-- SAFETY: money only moves when live provider keys are configured. With no keys
-- the simulated provider completes the purchase in-process (never charges,
-- never touches the network). Card data never touches Taurus — checkout is
-- hosted and only opaque provider ids are stored.
-- ===========================================================================

-- Pricing lives on the listing. NULL / 'free' price_model = free (today's flow).
alter table marketplace_listings
  add column if not exists price_model text not null default 'free',   -- free | one_time
  add column if not exists price_amount integer,                       -- minor units (e.g. cents)
  add column if not exists price_currency text;                        -- ISO 4217 lower, e.g. 'usd','inr'

-- A purchase of a listing. One row per checkout attempt; fulfillment is
-- idempotent on (provider, external_payment_id) and on our own reference.
create table if not exists marketplace_payments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references marketplace_listings(id) on delete cascade,
  hire_id uuid references marketplace_hires(id) on delete set null,
  buyer_organization_id uuid not null references organizations(id) on delete cascade,
  seller_organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null,                       -- stripe | razorpay | simulated
  -- Opaque reference WE generate and hand to the provider; used to reconcile the
  -- webhook back to this row without trusting the request body for identity.
  reference text not null unique,
  external_payment_id text,                     -- provider session / order / link id
  amount integer not null,                      -- minor units, > 0
  currency text not null,
  platform_fee integer not null default 0,      -- minor units retained by the platform
  seller_net integer not null default 0,        -- minor units owed to the seller
  status text not null default 'pending',       -- pending | paid | failed | refunded
  created_by_user_id uuid references users(id),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_marketplace_payments_listing on marketplace_payments (listing_id);
create index if not exists idx_marketplace_payments_buyer on marketplace_payments (buyer_organization_id);
create index if not exists idx_marketplace_payments_seller on marketplace_payments (seller_organization_id);
create index if not exists idx_marketplace_payments_hire on marketplace_payments (hire_id);
create index if not exists idx_marketplace_payments_created_by_user_id on marketplace_payments (created_by_user_id);
-- Reconcile a provider event to a payment without a full scan.
create unique index if not exists idx_marketplace_payments_provider_extid
  on marketplace_payments (provider, external_payment_id)
  where external_payment_id is not null;
