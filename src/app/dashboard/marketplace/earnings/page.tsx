/**
 * Marketplace earnings + purchases (Sprint 034).
 *
 * Sellers see money received for their listings (with the platform fee + their
 * net); buyers see what they've paid. Payouts of the seller's net balance are a
 * follow-up — this page reports the revenue-share ledger, it does not disburse.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { listBuyerPayments, listSellerPayments } from "@/modules/marketplace/service";
import { formatMoney } from "@/modules/marketplace/pricing";
import type { MarketplacePayment } from "@/lib/db/types";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

function statusTone(status: MarketplacePayment["status"]): "soft" | "outline" {
  return status === "paid" ? "soft" : "outline";
}

/** Sum the seller's net across settled payments, grouped by currency. */
function sumNetByCurrency(payments: MarketplacePayment[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of payments) {
    if (p.status !== "paid") continue;
    out[p.currency] = (out[p.currency] ?? 0) + p.sellerNet;
  }
  return out;
}

export default async function MarketplaceEarningsPage() {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "employee.view")) redirect("/dashboard");

  const store = getStore();
  const [earnings, purchases] = await Promise.all([
    listSellerPayments(store, organization.id),
    listBuyerPayments(store, organization.id),
  ]);

  const titleFor = async (listingId: string) =>
    (await store.getMarketplaceListing(listingId))?.title ?? "AI Employee";
  const earningRows = await Promise.all(
    earnings.map(async (p) => ({ p, title: await titleFor(p.listingId) })),
  );
  const purchaseRows = await Promise.all(
    purchases.map(async (p) => ({ p, title: await titleFor(p.listingId) })),
  );
  const netByCurrency = sumNetByCurrency(earnings);

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm">
        <Link
          href="/dashboard/marketplace"
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← Back to Marketplace
        </Link>
      </p>
      <PageHeader
        eyebrow="Marketplace"
        title="Earnings & purchases"
        description="Money received for your listings and what you've paid to hire. Only the DNA is sold — your knowledge vault is never shared."
      />

      {/* Seller net balance */}
      {Object.keys(netByCurrency).length > 0 ? (
        <Card className="mb-6 p-5">
          <p className="text-sm font-medium text-taurus-text">Net earned (after platform fee)</p>
          <div className="mt-2 flex flex-wrap gap-4">
            {Object.entries(netByCurrency).map(([currency, net]) => (
              <div key={currency}>
                <div className="text-2xl font-semibold text-taurus-text">
                  {formatMoney(net, currency)}
                </div>
                <div className="text-xs text-taurus-faint">settled</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-taurus-faint">
            This is your revenue-share balance. Payouts to your bank are coming soon.
          </p>
        </Card>
      ) : null}

      {/* Earnings */}
      <h2 className="mb-3 text-base font-semibold text-taurus-text">Earnings</h2>
      {earningRows.length === 0 ? (
        <EmptyState
          title="No earnings yet."
          description="When another organization buys one of your priced AI Employees, it shows up here."
        />
      ) : (
        <Card className="mb-8 divide-y divide-taurus-line overflow-hidden p-0">
          <ul>
            {earningRows.map(({ p, title }) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-taurus-text">{title}</p>
                  <p className="text-xs text-taurus-faint">
                    Gross {formatMoney(p.amount, p.currency)} · fee{" "}
                    {formatMoney(p.platformFee, p.currency)} · via {p.provider}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-taurus-text">
                    {formatMoney(p.sellerNet, p.currency)}
                  </div>
                  <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Purchases */}
      <h2 className="mb-3 text-base font-semibold text-taurus-text">Purchases</h2>
      {purchaseRows.length === 0 ? (
        <EmptyState
          title="No purchases yet."
          description="AI Employees you buy from the marketplace show up here."
        />
      ) : (
        <Card className="divide-y divide-taurus-line overflow-hidden p-0">
          <ul>
            {purchaseRows.map(({ p, title }) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/marketplace/${p.listingId}`}
                    className="truncate text-sm font-medium text-taurus-text hover:underline"
                  >
                    {title}
                  </Link>
                  <p className="text-xs text-taurus-faint">via {p.provider}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-taurus-text">
                    {formatMoney(p.amount, p.currency)}
                  </div>
                  <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
