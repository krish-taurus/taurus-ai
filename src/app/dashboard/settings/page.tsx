import Link from "next/link";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { buttonClasses, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const { membership } = await requireCurrentOrganization();
  const canViewModelHub = hasPermission(membership.role, "model_hub.view");
  const canViewBilling = hasPermission(membership.role, "billing.view");

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage your organization, models, and workspace preferences."
      />

      {canViewModelHub ? (
        <Card className="mb-6 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-taurus-text">Model Hub</h2>
              <p className="mt-1.5 text-sm text-taurus-sub">
                Choose which AI models power your Employees and keep Taurus provider-agnostic.
              </p>
            </div>
            <Link href="/dashboard/settings/models" className={buttonClasses("secondary")}>
              Open Model Hub
            </Link>
          </div>
        </Card>
      ) : null}

      {canViewBilling ? (
        <Card className="mb-6 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-taurus-text">Billing</h2>
              <p className="mt-1.5 text-sm text-taurus-sub">
                See your plan, usage, and subscription — and upgrade when you&apos;re ready.
              </p>
            </div>
            <Link href="/dashboard/settings/billing" className={buttonClasses("secondary")}>
              Open Billing
            </Link>
          </div>
        </Card>
      ) : null}

      <EmptyState
        title="More settings are coming soon."
        description="Organization and member management arrive in a later step."
      />
    </div>
  );
}
