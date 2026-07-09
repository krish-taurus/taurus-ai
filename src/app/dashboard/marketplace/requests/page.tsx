import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { listIncomingHires } from "@/modules/marketplace/service";
import { HireDecision } from "@/components/marketplace/marketplace-buttons";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function MarketplaceRequestsPage() {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "employee.manage")) redirect("/dashboard/marketplace");

  const store = getStore();
  const hires = await listIncomingHires(store, organization.id);

  // Resolve display names for the listing + requesting org (small N).
  const rows = await Promise.all(
    hires.map(async (h) => {
      const listing = await store.getMarketplaceListing(h.listingId);
      const hirerOrg = await store.getOrganizationById(h.hirerOrganizationId);
      return { hire: h, listingTitle: listing?.title ?? "AI Employee", hirerName: hirerOrg?.name ?? "An organization" };
    }),
  );

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm">
        <Link href="/dashboard/marketplace" className="font-medium text-taurus-sub hover:text-taurus-text">
          ← Back to Marketplace
        </Link>
      </p>
      <PageHeader
        eyebrow="Marketplace"
        title="Hire requests"
        description="Organizations that want to hire your published AI Employees. Approving clones their DNA into their workspace — your knowledge vault is never shared."
      />

      {rows.length === 0 ? (
        <EmptyState title="No hire requests yet." description="When another organization requests one of your listed AI Employees, it appears here." />
      ) : (
        <Card className="divide-y divide-taurus-line overflow-hidden p-0">
          <ul>
            {rows.map(({ hire, listingTitle, hirerName }) => (
              <li key={hire.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-taurus-text">
                    {hirerName} · {listingTitle}
                  </p>
                  {hire.note ? <p className="mt-0.5 text-sm text-taurus-sub">“{hire.note}”</p> : null}
                  <div className="mt-1.5">
                    <Badge tone={hire.status === "approved" ? "soft" : "outline"}>{hire.status}</Badge>
                  </div>
                </div>
                {hire.status === "requested" ? <HireDecision hireId={hire.id} /> : null}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
