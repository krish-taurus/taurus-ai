-- ===========================================================================
-- Taurus AI — Marketplace ratings & reviews (Sprint 032)
--
-- An organization that has actually HIRED a listed AI Employee (an approved
-- marketplace_hire) can leave a 1–5 star rating + short review on its resume, so
-- other buyers can judge it. One review per reviewing organization per listing.
--
-- The listing carries a denormalized rating_count / rating_avg so the directory
-- can show ratings without a per-row aggregate; the app recomputes them whenever
-- a review is written.
-- ===========================================================================

create table if not exists marketplace_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references marketplace_listings(id) on delete cascade,
  reviewer_organization_id uuid not null references organizations(id) on delete cascade,
  reviewer_user_id uuid references users(id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, reviewer_organization_id)
);

create index if not exists idx_marketplace_reviews_listing on marketplace_reviews (listing_id);
create index if not exists idx_marketplace_reviews_reviewer_org on marketplace_reviews (reviewer_organization_id);
create index if not exists idx_marketplace_reviews_reviewer_user_id on marketplace_reviews (reviewer_user_id);

alter table marketplace_listings
  add column if not exists rating_count integer not null default 0,
  add column if not exists rating_avg real;
