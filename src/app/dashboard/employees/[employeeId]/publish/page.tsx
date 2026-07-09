import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { PublishForm } from "@/components/marketplace/publish-form";
import { UnpublishButton } from "@/components/marketplace/marketplace-buttons";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function PublishEmployeePage({
  params,
}: {
  params: { employeeId: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "employee.manage")) {
    redirect(`/dashboard/employees/${params.employeeId}`);
  }

  const store = getStore();
  const employee = await store.getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  const published = await store.getPublishedEmployeeDna(organization.id, params.employeeId);
  const listing = await store.getMarketplaceListingForEmployee(organization.id, params.employeeId);
  const isLive = listing?.status === "published";

  return (
    <div className="max-w-2xl">
      <p className="mb-4 text-sm">
        <Link
          href={`/dashboard/employees/${employee.id}`}
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← Back to {employee.name}
        </Link>
      </p>

      <PageHeader
        eyebrow="Marketplace"
        title={`Publish ${employee.name}`}
        description="List this AI Employee so other organizations can review its resume and hire it. Hiring clones only its DNA — your knowledge vault is never shared."
        action={
          listing ? (
            <div className="flex items-center gap-2">
              <Badge tone={isLive ? "soft" : "outline"}>{listing.status}</Badge>
              <Link
                href={`/dashboard/marketplace/${listing.id}`}
                className="text-sm font-medium text-taurus-sub hover:text-taurus-text"
              >
                View resume
              </Link>
            </div>
          ) : undefined
        }
      />

      {!published ? (
        <Card className="p-6 text-sm text-taurus-sub">
          This AI Employee has no published DNA yet. Publish its DNA first — the resume is built
          from published DNA.{" "}
          <Link
            href={`/dashboard/employees/${employee.id}/dna`}
            className="font-medium text-taurus-text hover:underline"
          >
            Edit DNA →
          </Link>
        </Card>
      ) : (
        <Card className="space-y-6 p-6">
          <PublishForm
            employeeId={employee.id}
            defaultTitle={listing?.title ?? employee.name}
            defaultHeadline={listing?.headline ?? undefined}
            defaultSummary={listing?.summary ?? undefined}
            includeVaults={listing?.includeVaults}
            alreadyPublished={isLive}
          />
          {isLive ? (
            <div className="border-t border-taurus-line pt-4">
              <p className="mb-2 text-sm text-taurus-sub">
                Remove this AI Employee from the marketplace. Your employee and its DNA are unaffected.
              </p>
              <UnpublishButton listingId={listing.id} />
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
