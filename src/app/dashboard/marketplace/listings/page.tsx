import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { listIncomingHires, listOwnListings } from "@/modules/marketplace/service";
import { buttonClasses, Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function MyListingsPage() {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "employee.manage")) redirect("/dashboard/marketplace");

  const store = getStore();
  const [listings, incoming] = await Promise.all([
    listOwnListings(store, organization.id),
    listIncomingHires(store, organization.id),
  ]);
  const pending = incoming.filter((h) => h.status === "requested").length;

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm">
        <Link href="/dashboard/marketplace" className="font-medium text-taurus-sub hover:text-taurus-text">
          ← Back to Marketplace
        </Link>
      </p>
      <PageHeader
        eyebrow="Marketplace"
        title="My listings"
        description="AI Employees your organization has published, and incoming hire requests."
        action={
          <Link href="/dashboard/marketplace/requests" className={buttonClasses("secondary")}>
            Hire requests{pending > 0 ? ` (${pending})` : ""}
          </Link>
        }
      />

      {listings.length === 0 ? (
        <EmptyState
          title="You haven't published any AI Employees."
          description="Open an AI Employee and choose 'Publish to marketplace' to list it."
          action={
            <Link href="/dashboard/employees" className={buttonClasses("primary", "lg")}>
              Go to AI Employees
            </Link>
          }
        />
      ) : (
        <Card className="divide-y divide-taurus-line overflow-hidden p-0">
          <ul>
            {listings.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/marketplace/${l.id}`}
                    className="text-sm font-medium text-taurus-text hover:underline"
                  >
                    {l.title}
                  </Link>
                  {l.roleTitle ? <p className="text-sm text-taurus-sub">{l.roleTitle}</p> : null}
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge tone={l.status === "published" ? "soft" : "outline"}>{l.status}</Badge>
                    {l.includeVaults ? <Badge tone="outline">with vaults</Badge> : null}
                  </div>
                </div>
                <Link
                  href={`/dashboard/employees/${l.employeeId}/publish`}
                  className={buttonClasses("secondary", "sm")}
                >
                  Manage
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
