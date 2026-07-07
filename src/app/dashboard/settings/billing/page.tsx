import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { getBillingProvider } from "@/modules/billing/providers";
import { getBillingOverview } from "@/modules/billing/service";
import { SUBSCRIPTION_STATUS_LABELS, SIMULATED_BILLING_NOTICE } from "@/modules/billing/metadata";
import { UsageMeter } from "@/components/billing/usage-meter";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";
import { Badge, buttonClasses, Card, Notice, PageHeader } from "@/components/ui";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function BillingPage() {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "billing.view")) {
    redirect("/dashboard");
  }
  const canManage = hasPermission(membership.role, "billing.manage");

  const overview = await getBillingOverview(getStore(), organization.id, getBillingProvider());
  const { plan, subscription, usage, simulated } = overview;

  const priceLabel = plan.isFree ? "Free" : `$${plan.monthlyPriceUsd}/mo`;

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Billing"
        description="Your plan, usage, and subscription for this organization."
        action={
          canManage ? (
            <Link href="/dashboard/settings/billing/plans" className={buttonClasses("primary")}>
              Upgrade plan
            </Link>
          ) : undefined
        }
      />

      {simulated ? <Notice>{SIMULATED_BILLING_NOTICE}</Notice> : null}

      <Card className="mt-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-taurus-text">{plan.name}</h2>
              <Badge tone="soft">{SUBSCRIPTION_STATUS_LABELS[subscription.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-taurus-sub">{plan.tagline}</p>
            <p className="mt-3 text-sm text-taurus-text">{priceLabel}</p>
            <p className="mt-1 text-xs text-taurus-faint">
              Current period: {formatDate(subscription.currentPeriodStart)} –{" "}
              {formatDate(subscription.currentPeriodEnd)}
            </p>
            {subscription.cancelAtPeriodEnd ? (
              <p className="mt-1 text-xs text-taurus-faint">
                Your plan is set to end when this period closes.
              </p>
            ) : null}
          </div>
          {canManage ? (
            <div className="flex flex-col items-stretch gap-2">
              <Link href="/dashboard/settings/billing/plans" className={buttonClasses("secondary")}>
                Change plan
              </Link>
              <ManageBillingButton />
            </div>
          ) : null}
        </div>
      </Card>

      <h3 className="mt-8 text-sm font-semibold text-taurus-text">Usage this period</h3>
      <p className="mt-1 text-sm text-taurus-sub">How much of your plan you&apos;ve used so far.</p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UsageMeter usage={usage.interactions} />
        <UsageMeter usage={usage.employees} />
        <UsageMeter usage={usage.knowledgeSources} />
        <UsageMeter usage={usage.connections} />
      </div>

      {!canManage ? (
        <p className="mt-6 text-xs text-taurus-faint">
          Only owners and admins can change the plan or manage billing.
        </p>
      ) : null}
    </div>
  );
}
