import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { listMarketplace } from "@/modules/marketplace/service";
import { formatMoney, isPricedListing } from "@/modules/marketplace/pricing";
import { RatingSummary } from "@/components/marketplace/rating-stars";
import { buttonClasses, Badge, Card, EmptyState, PageHeader } from "@/components/ui";

function scorePct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

export default async function MarketplacePage() {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "employee.view")) redirect("/dashboard");

  const listings = await listMarketplace(getStore());

  return (
    <div>
      <PageHeader
        eyebrow="Marketplace"
        title="Hire a proven AI Employee"
        description="Browse AI Employees published by organizations across the network. Hiring clones their DNA into your workspace — its knowledge vault is never shared."
        action={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/marketplace/earnings" className={buttonClasses("secondary")}>
              Earnings
            </Link>
            {hasPermission(membership.role, "employee.manage") ? (
              <Link href="/dashboard/marketplace/listings" className={buttonClasses("secondary")}>
                My listings
              </Link>
            ) : null}
          </div>
        }
      />

      {listings.length === 0 ? (
        <EmptyState
          title="No AI Employees are listed yet."
          description="When organizations publish their AI Employees, their resumes appear here to review and hire."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => {
            const own = l.organizationId === organization.id;
            return (
              <Link key={l.id} href={`/dashboard/marketplace/${l.id}`}>
                <Card className="flex h-full flex-col gap-3 p-5 transition-colors hover:border-taurus-strong">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-taurus-text">
                        {l.title}
                      </h3>
                      {l.roleTitle ? (
                        <p className="truncate text-sm text-taurus-sub">{l.roleTitle}</p>
                      ) : null}
                    </div>
                    {own ? <Badge tone="outline">Yours</Badge> : null}
                  </div>
                  {l.headline ? (
                    <p className="line-clamp-2 text-sm text-taurus-sub">{l.headline}</p>
                  ) : null}
                  <RatingSummary avg={l.ratingAvg} count={l.ratingCount} />
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {isPricedListing(l) ? (
                      <Badge tone="soft">
                        {formatMoney(l.priceAmount as number, l.priceCurrency as string)}
                      </Badge>
                    ) : (
                      <Badge tone="outline">Free</Badge>
                    )}
                    <Badge tone="soft">Best {scorePct(l.performanceSnapshot.bestScore)}</Badge>
                    <Badge tone="outline">
                      {l.performanceSnapshot.reviewCount}{" "}
                      {l.performanceSnapshot.reviewCount === 1 ? "review" : "reviews"}
                    </Badge>
                    {l.includeVaults && l.vaultSnapshot.length > 0 ? (
                      <Badge tone="outline">{l.vaultSnapshot.length} vaults</Badge>
                    ) : null}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
