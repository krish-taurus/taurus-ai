/**
 * Public marketplace directory (Sprint 051).
 *
 * An unauthenticated, LinkedIn-style browse of every published AI Employee, with
 * search + role / price / rating filters and sorting. Anyone can look; the cards
 * link to each public resume, and hiring / leasing requires signing in (the
 * resume page and this header both route into the authenticated flow). Only the
 * public listing snapshot is shown — no private vault content.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { getStore } from "@/lib/db/store";
import { listMarketplace } from "@/modules/marketplace/service";
import { formatMoney, isPricedListing } from "@/modules/marketplace/pricing";
import {
  applyBrowse,
  availableRoles,
  parseBrowseQuery,
  BROWSE_SORTS,
} from "@/modules/marketplace/browse";
import { RatingSummary } from "@/components/marketplace/rating-stars";
import { buttonClasses, Badge, Card, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hire an AI Employee — Taurus AI Marketplace",
  description:
    "Browse proven AI Employees published by organizations across the network. Filter by role, price and rating; sign in to hire.",
};

function scorePct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

const RATINGS = [
  { value: "0", label: "Any rating" },
  { value: "4", label: "4★ & up" },
  { value: "4.5", label: "4.5★ & up" },
];
const PRICES = [
  { value: "all", label: "Any price" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
];

export default async function PublicMarketplacePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const all = await listMarketplace(getStore());
  const query = parseBrowseQuery(searchParams);
  const roles = availableRoles(all);
  const listings = applyBrowse(all, query);

  return (
    <div className="min-h-screen bg-taurus-app">
      <header className="border-b border-taurus-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/marketplace" className="text-sm font-semibold tracking-tight text-taurus-text">
            Taurus AI
          </Link>
          <Link href="/signin" className={buttonClasses("secondary", "sm")}>
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-wide text-taurus-faint">Marketplace</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-taurus-text">
          Hire a proven AI Employee
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-taurus-sub">
          Browse AI Employees published by organizations across the network. Hiring clones an
          employee&apos;s DNA into your workspace — its knowledge vault is never shared. Sign in to
          hire, lease, or subscribe.
        </p>

        {/* Filters (server-rendered GET form — no JavaScript needed) */}
        <form method="get" className="mt-6 grid grid-cols-1 gap-3 rounded-xl border border-taurus-line bg-taurus-elevated p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label htmlFor="q" className="mb-1 block text-xs font-medium text-taurus-faint">Search</label>
            <input
              id="q"
              name="q"
              defaultValue={query.q ?? ""}
              placeholder="Role, skill, or name…"
              className="w-full rounded-lg border border-taurus-line bg-taurus-app px-3 py-2 text-sm text-taurus-text placeholder:text-taurus-faint focus:border-taurus-strong focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="role" className="mb-1 block text-xs font-medium text-taurus-faint">Role</label>
            <select id="role" name="role" defaultValue={query.role ?? "all"} className="w-full rounded-lg border border-taurus-line bg-taurus-app px-3 py-2 text-sm text-taurus-text focus:border-taurus-strong focus:outline-none">
              <option value="all">All roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="price" className="mb-1 block text-xs font-medium text-taurus-faint">Price</label>
            <select id="price" name="price" defaultValue={query.price ?? "all"} className="w-full rounded-lg border border-taurus-line bg-taurus-app px-3 py-2 text-sm text-taurus-text focus:border-taurus-strong focus:outline-none">
              {PRICES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rating" className="mb-1 block text-xs font-medium text-taurus-faint">Rating</label>
            <select id="rating" name="rating" defaultValue={String(query.minRating ?? 0)} className="w-full rounded-lg border border-taurus-line bg-taurus-app px-3 py-2 text-sm text-taurus-text focus:border-taurus-strong focus:outline-none">
              {RATINGS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 lg:col-span-4">
            <div className="flex-1">
              <label htmlFor="sort" className="mb-1 block text-xs font-medium text-taurus-faint">Sort by</label>
              <select id="sort" name="sort" defaultValue={query.sort ?? "top_rated"} className="w-full rounded-lg border border-taurus-line bg-taurus-app px-3 py-2 text-sm text-taurus-text focus:border-taurus-strong focus:outline-none">
                {BROWSE_SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <button type="submit" className={buttonClasses("primary", "md")}>Apply</button>
            <Link href="/marketplace" className={buttonClasses("ghost", "md")}>Clear</Link>
          </div>
        </form>

        <p className="mt-4 text-xs text-taurus-faint">
          {listings.length} {listings.length === 1 ? "AI Employee" : "AI Employees"}
          {all.length !== listings.length ? ` of ${all.length}` : ""}
        </p>

        {/* Results */}
        {all.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No AI Employees are listed yet."
              description="When organizations publish their AI Employees, they appear here to browse and hire."
            />
          </div>
        ) : listings.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No matches."
              description="Try clearing a filter or broadening your search."
            />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <Link key={l.id} href={`/marketplace/${l.publicKey}`}>
                <Card className="flex h-full flex-col gap-3 p-5 transition-colors hover:border-taurus-strong">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-taurus-text">{l.title}</h3>
                    {l.roleTitle ? <p className="truncate text-sm text-taurus-sub">{l.roleTitle}</p> : null}
                  </div>
                  {l.headline ? <p className="line-clamp-2 text-sm text-taurus-sub">{l.headline}</p> : null}
                  <RatingSummary avg={l.ratingAvg} count={l.ratingCount} />
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {isPricedListing(l) ? (
                      <Badge tone="soft">{formatMoney(l.priceAmount as number, l.priceCurrency as string)}</Badge>
                    ) : (
                      <Badge tone="outline">Free</Badge>
                    )}
                    <Badge tone="soft">Best {scorePct(l.performanceSnapshot.bestScore)}</Badge>
                    {l.hireCount > 0 ? <Badge tone="outline">{l.hireCount} hired</Badge> : null}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
