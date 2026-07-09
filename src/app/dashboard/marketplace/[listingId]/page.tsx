import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { ResumeView } from "@/components/marketplace/resume-view";
import { HireButton, UnpublishButton } from "@/components/marketplace/marketplace-buttons";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function MarketplaceListingPage({
  params,
  searchParams,
}: {
  params: { listingId: string };
  searchParams?: { requested?: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "employee.view")) redirect("/dashboard");

  const listing = await getStore().getMarketplaceListing(params.listingId);
  // Only published listings are visible cross-org; owners can see their own.
  const own = listing?.organizationId === organization.id;
  if (!listing || (listing.status !== "published" && !own)) notFound();

  const canHire = hasPermission(membership.role, "employee.create");

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm">
        <Link href="/dashboard/marketplace" className="font-medium text-taurus-sub hover:text-taurus-text">
          ← Back to Marketplace
        </Link>
      </p>

      <PageHeader
        eyebrow="Employee resume"
        title={listing.title}
        description={listing.roleTitle ?? undefined}
        action={
          own ? (
            <div className="flex items-center gap-2">
              <Badge tone="outline">{listing.status}</Badge>
              {listing.status === "published" ? <UnpublishButton listingId={listing.id} /> : null}
            </div>
          ) : canHire ? (
            <HireButton listingId={listing.id} />
          ) : undefined
        }
      />

      {searchParams?.requested ? (
        <Card className="mb-6 border-taurus-line bg-taurus-muted p-4 text-sm text-taurus-text">
          Your hire request was sent. The owner will review it — once approved, a copy of this
          AI Employee (its DNA only) appears in your AI Employees.
        </Card>
      ) : null}

      {own ? (
        <p className="mb-6 text-sm text-taurus-sub">
          This is your listing. It shows a snapshot taken when you published — re-publish from the
          employee to refresh its performance and DNA.
        </p>
      ) : null}

      <ResumeView listing={listing} />

      {!own && canHire ? (
        <Card className="mt-6 p-5">
          <p className="mb-3 text-sm text-taurus-sub">
            Hiring clones this AI Employee&apos;s DNA into your workspace as a new AI Employee. The
            owner&apos;s knowledge vault is never shared — you attach your own knowledge and model
            keys.
          </p>
          <HireButton listingId={listing.id} />
        </Card>
      ) : null}
    </div>
  );
}
