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
import {
  listBuyerPayments,
  listSellerPayments,
  getPayoutAccount,
  getSellerBalances,
  listPayouts,
} from "@/modules/marketplace/service";
import { availablePaymentProviders } from "@/modules/marketplace/payments";
import { formatMoney } from "@/modules/marketplace/pricing";
import type { MarketplacePayment, MarketplacePayout } from "@/lib/db/types";
import {
  ConnectPayoutButton,
  WithdrawButton,
} from "@/components/marketplace/payout-buttons";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

function statusTone(status: MarketplacePayment["status"] | MarketplacePayout["status"]): "soft" | "outline" {
  return status === "paid" ? "soft" : "outline";
}

export default async function MarketplaceEarningsPage({
  searchParams,
}: {
  searchParams?: { connected?: string; withdrawn?: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "employee.view")) redirect("/dashboard");
  const canManage = hasPermission(membership.role, "employee.manage");

  const store = getStore();
  const [earnings, purchases, payoutAccount, balances, payouts] = await Promise.all([
    listSellerPayments(store, organization.id),
    listBuyerPayments(store, organization.id),
    getPayoutAccount(store, organization.id),
    getSellerBalances(store, organization.id),
    listPayouts(store, organization.id),
  ]);
  const providers = availablePaymentProviders();
  const accountActive = payoutAccount?.status === "active";

  const titleFor = async (listingId: string) =>
    (await store.getMarketplaceListing(listingId))?.title ?? "AI Employee";
  const earningRows = await Promise.all(
    earnings.map(async (p) => ({ p, title: await titleFor(p.listingId) })),
  );
  const purchaseRows = await Promise.all(
    purchases.map(async (p) => ({ p, title: await titleFor(p.listingId) })),
  );
  const hasBalances = balances.some((b) => b.earned > 0);

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

      {searchParams?.connected ? (
        <Card className="mb-6 border-taurus-line bg-taurus-muted p-4 text-sm text-taurus-text">
          Payout account connected. Available balances can now be withdrawn.
        </Card>
      ) : null}
      {searchParams?.withdrawn ? (
        <Card className="mb-6 border-taurus-line bg-taurus-muted p-4 text-sm text-taurus-text">
          Withdrawal sent to your connected account.
        </Card>
      ) : null}

      {/* Balance + payout account */}
      {hasBalances ? (
        <Card className="mb-6 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-taurus-text">
              Balance (net of the platform fee)
            </p>
            {payoutAccount ? (
              <Badge tone={accountActive ? "soft" : "outline"}>
                {payoutAccount.provider} · {payoutAccount.status}
              </Badge>
            ) : null}
          </div>

          <div className="space-y-3">
            {balances.map((b) => (
              <div
                key={b.currency}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-taurus-line pt-3 first:border-0 first:pt-0"
              >
                <div>
                  <div className="text-2xl font-semibold text-taurus-text">
                    {formatMoney(b.available, b.currency)}
                  </div>
                  <div className="text-xs text-taurus-faint">
                    available · {formatMoney(b.paidOut, b.currency)} withdrawn ·{" "}
                    {formatMoney(b.pending, b.currency)} in flight
                  </div>
                </div>
                {canManage && accountActive && b.available > 0 ? (
                  <WithdrawButton
                    currency={b.currency}
                    label={`Withdraw ${formatMoney(b.available, b.currency)}`}
                  />
                ) : null}
              </div>
            ))}
          </div>

          {canManage ? (
            <div className="mt-4 border-t border-taurus-line pt-4">
              {accountActive ? (
                <p className="text-xs text-taurus-faint">
                  Withdrawals go to your connected {payoutAccount?.provider} account. Payouts move
                  only the revenue-share balance — never your knowledge vault.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-taurus-faint">
                    {payoutAccount
                      ? "Finish connecting your payout account to withdraw."
                      : "Connect a payout account to withdraw your balance."}
                  </p>
                  <ConnectPayoutButton
                    providers={providers}
                    label={payoutAccount ? "Finish connecting" : "Connect payout account"}
                  />
                </div>
              )}
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Payout history */}
      {payouts.length > 0 ? (
        <Card className="mb-8 p-5">
          <p className="mb-3 text-sm font-medium text-taurus-text">Payout history</p>
          <ul className="space-y-2">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-taurus-sub">
                  {formatMoney(p.amount, p.currency)} · via {p.provider}
                </span>
                <Badge tone={statusTone(p.status)}>{p.status}</Badge>
              </li>
            ))}
          </ul>
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
