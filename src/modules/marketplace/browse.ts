/**
 * Public marketplace directory — browse, filter, sort (Sprint 051).
 *
 * Pure functions over the already-fetched published listings, so the public
 * `/marketplace` directory can filter/sort without another query and everything
 * stays unit-testable. No store, no auth, no secrets — listings are already the
 * public snapshot shown on each resume page.
 */

import type { MarketplaceListing } from "@/lib/db/types";
import { isPricedListing } from "@/modules/marketplace/pricing";

export type BrowseSort = "top_rated" | "most_hired" | "newest" | "price_low" | "price_high";
export type PriceFilter = "all" | "free" | "paid";

export interface BrowseQuery {
  q?: string;
  role?: string;
  price?: PriceFilter;
  minRating?: number;
  sort?: BrowseSort;
}

export const BROWSE_SORTS: { value: BrowseSort; label: string }[] = [
  { value: "top_rated", label: "Top rated" },
  { value: "most_hired", label: "Most hired" },
  { value: "newest", label: "Newest" },
  { value: "price_low", label: "Price: low to high" },
  { value: "price_high", label: "Price: high to low" },
];

/** Parse raw search params (strings) into a validated BrowseQuery. */
export function parseBrowseQuery(params: Record<string, string | string[] | undefined>): BrowseQuery {
  const str = (v: string | string[] | undefined): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;
  const price = str(params.price);
  const sort = str(params.sort);
  const rating = Number(str(params.rating));
  return {
    q: str(params.q),
    role: str(params.role),
    price: price === "free" || price === "paid" ? price : "all",
    minRating: Number.isFinite(rating) && rating > 0 ? Math.min(5, rating) : 0,
    sort: BROWSE_SORTS.some((s) => s.value === sort) ? (sort as BrowseSort) : "top_rated",
  };
}

/** Distinct role titles present in the listings, for the role filter dropdown. */
export function availableRoles(listings: MarketplaceListing[]): string[] {
  const roles = new Set<string>();
  for (const l of listings) if (l.roleTitle) roles.add(l.roleTitle);
  return [...roles].sort((a, b) => a.localeCompare(b));
}

function matchesText(listing: MarketplaceListing, q: string): boolean {
  const hay = [listing.title, listing.roleTitle, listing.headline, listing.summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

function priceMinor(listing: MarketplaceListing): number {
  return isPricedListing(listing) ? (listing.priceAmount ?? 0) : 0;
}

/** Filter + sort published listings for the public directory. */
export function applyBrowse(
  listings: MarketplaceListing[],
  query: BrowseQuery,
): MarketplaceListing[] {
  let out = listings.slice();

  if (query.q) out = out.filter((l) => matchesText(l, query.q as string));
  if (query.role && query.role !== "all") out = out.filter((l) => l.roleTitle === query.role);
  if (query.price === "free") out = out.filter((l) => !isPricedListing(l));
  else if (query.price === "paid") out = out.filter((l) => isPricedListing(l));
  if (query.minRating && query.minRating > 0) {
    out = out.filter((l) => (l.ratingAvg ?? 0) >= (query.minRating as number));
  }

  const byDateDesc = (a: MarketplaceListing, b: MarketplaceListing) =>
    (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt);

  switch (query.sort) {
    case "most_hired":
      out.sort((a, b) => b.hireCount - a.hireCount || byDateDesc(a, b));
      break;
    case "newest":
      out.sort(byDateDesc);
      break;
    case "price_low":
      out.sort((a, b) => priceMinor(a) - priceMinor(b) || byDateDesc(a, b));
      break;
    case "price_high":
      out.sort((a, b) => priceMinor(b) - priceMinor(a) || byDateDesc(a, b));
      break;
    case "top_rated":
    default:
      // Rating desc (unrated last), then more reviews, then newest.
      out.sort(
        (a, b) =>
          (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1) ||
          b.ratingCount - a.ratingCount ||
          byDateDesc(a, b),
      );
      break;
  }
  return out;
}
