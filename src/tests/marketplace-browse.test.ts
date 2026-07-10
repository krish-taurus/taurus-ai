import { describe, it, expect } from "vitest";
import type { MarketplaceListing } from "@/lib/db/types";
import { applyBrowse, availableRoles, parseBrowseQuery } from "@/modules/marketplace/browse";

/** Minimal listing factory — only the fields the browse logic reads matter. */
function mk(over: Partial<MarketplaceListing>): MarketplaceListing {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    organizationId: "org",
    employeeId: "emp",
    publicKey: over.publicKey ?? "pk",
    title: over.title ?? "Agent",
    headline: over.headline ?? null,
    summary: over.summary ?? null,
    roleTitle: over.roleTitle ?? null,
    status: "published",
    includeVaults: false,
    priceModel: over.priceModel ?? "free",
    priceAmount: over.priceAmount ?? null,
    priceCurrency: over.priceCurrency ?? null,
    dnaVersionNumber: 1,
    dnaSnapshot: {} as MarketplaceListing["dnaSnapshot"],
    performanceSnapshot: { bestScore: null, reviewCount: 0 } as MarketplaceListing["performanceSnapshot"],
    vaultSnapshot: [],
    hireCount: over.hireCount ?? 0,
    ratingCount: over.ratingCount ?? 0,
    ratingAvg: over.ratingAvg ?? null,
    createdByUserId: null,
    publishedAt: over.publishedAt ?? "2026-01-01T00:00:00.000Z",
    createdAt: over.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("parseBrowseQuery", () => {
  it("normalizes params with safe defaults", () => {
    expect(parseBrowseQuery({})).toEqual({
      q: undefined,
      role: undefined,
      price: "all",
      minRating: 0,
      sort: "top_rated",
    });
    expect(parseBrowseQuery({ price: "free", rating: "4.5", sort: "most_hired", q: "  refund  " })).toMatchObject({
      price: "free",
      minRating: 4.5,
      sort: "most_hired",
      q: "refund",
    });
    // Invalid values fall back to defaults.
    expect(parseBrowseQuery({ price: "junk", sort: "nope", rating: "-3" })).toMatchObject({
      price: "all",
      sort: "top_rated",
      minRating: 0,
    });
  });
});

describe("applyBrowse", () => {
  const listings = [
    mk({ title: "Refund Specialist", roleTitle: "Support", ratingAvg: 4.8, ratingCount: 10, hireCount: 5, priceModel: "one_time", priceAmount: 5000, priceCurrency: "usd", publishedAt: "2026-06-01T00:00:00.000Z" }),
    mk({ title: "Sales Closer", roleTitle: "Sales", ratingAvg: 4.2, ratingCount: 3, hireCount: 20, publishedAt: "2026-07-01T00:00:00.000Z" }),
    mk({ title: "Onboarding Guide", roleTitle: "Support", ratingAvg: null, ratingCount: 0, hireCount: 1, priceModel: "one_time", priceAmount: 1000, priceCurrency: "usd", publishedAt: "2026-05-01T00:00:00.000Z" }),
  ];

  it("lists distinct roles sorted", () => {
    expect(availableRoles(listings)).toEqual(["Sales", "Support"]);
  });

  it("filters by free vs paid", () => {
    expect(applyBrowse(listings, { price: "free" }).map((l) => l.title)).toEqual(["Sales Closer"]);
    expect(applyBrowse(listings, { price: "paid" }).map((l) => l.title).sort()).toEqual([
      "Onboarding Guide",
      "Refund Specialist",
    ]);
  });

  it("filters by role, search text, and minimum rating", () => {
    expect(applyBrowse(listings, { role: "Support" }).map((l) => l.title).sort()).toEqual([
      "Onboarding Guide",
      "Refund Specialist",
    ]);
    expect(applyBrowse(listings, { q: "refund" }).map((l) => l.title)).toEqual(["Refund Specialist"]);
    expect(applyBrowse(listings, { minRating: 4.5 }).map((l) => l.title)).toEqual(["Refund Specialist"]);
  });

  it("sorts by top rated (unrated last), most hired, newest, and price", () => {
    expect(applyBrowse(listings, { sort: "top_rated" }).map((l) => l.title)).toEqual([
      "Refund Specialist",
      "Sales Closer",
      "Onboarding Guide",
    ]);
    expect(applyBrowse(listings, { sort: "most_hired" }).map((l) => l.title)).toEqual([
      "Sales Closer",
      "Refund Specialist",
      "Onboarding Guide",
    ]);
    expect(applyBrowse(listings, { sort: "newest" }).map((l) => l.title)).toEqual([
      "Sales Closer",
      "Refund Specialist",
      "Onboarding Guide",
    ]);
    expect(applyBrowse(listings, { sort: "price_low" }).map((l) => l.title)).toEqual([
      "Sales Closer", // free = 0
      "Onboarding Guide", // 1000
      "Refund Specialist", // 5000
    ]);
  });
});
