-- ===========================================================================
-- Taurus AI — Billing, Plans & Subscriptions (Sprint 015)
--
-- Plan prices and entitlements are AUTHORITATIVE IN CODE
-- (src/modules/billing/plans.ts), like the Model Hub catalog, so they cannot
-- drift. These tables hold only DYNAMIC per-organization state:
--   - billing_subscriptions : the org's current plan + status + period
--   - billing_customers      : org ↔ external (Stripe) customer id mapping
--   - billing_events         : metadata-only audit of billing state changes
--
-- No card data, customer email, or raw provider payloads are ever stored here.
-- Every table leads with organization_id for tenant-scoped indexing.
-- ===========================================================================

-- One subscription per organization. A Starter (Free) subscription is created
-- implicitly on organization creation; the partial unique index guarantees at
-- most one non-canceled (active/trialing/past_due) subscription per org.
create table if not exists billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id text not null,                         -- starter | growth | scale (code catalog)
  status text not null default 'active',         -- active | trialing | past_due | canceled
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  external_subscription_id text,                 -- Stripe subscription id (null in simulated mode)
  external_customer_id text,                     -- Stripe customer id (null in simulated mode)
  provider text not null default 'simulated',    -- stripe | simulated
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exactly one ACTIVE subscription per organization (partial unique index).
create unique index if not exists uniq_billing_subscription_active_org
  on billing_subscriptions (organization_id)
  where status <> 'canceled';

create index if not exists idx_billing_subscriptions_org
  on billing_subscriptions (organization_id);
create index if not exists idx_billing_subscriptions_external_sub
  on billing_subscriptions (external_subscription_id);

-- Organization ↔ external billing customer. Resolved server-side from stored
-- ids on the webhook path — never from client input.
create table if not exists billing_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references organizations(id) on delete cascade,
  external_customer_id text not null,
  provider text not null default 'stripe',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_customers_org
  on billing_customers (organization_id);
create index if not exists idx_billing_customers_external
  on billing_customers (external_customer_id);

-- Metadata-only audit of billing state changes (upgrade, downgrade, cancel,
-- webhook-driven status updates). Never card data or raw provider payloads.
create table if not exists billing_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_type text not null,                      -- e.g. subscription.upgraded, subscription.canceled
  plan_id text,
  status text,
  provider text not null,                        -- stripe | simulated
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_events_org_created
  on billing_events (organization_id, created_at desc);
