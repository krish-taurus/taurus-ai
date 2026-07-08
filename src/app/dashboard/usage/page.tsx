import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { getUsageOverview } from "@/modules/usage/service";
import { Card, Notice, PageHeader, Progress } from "@/components/ui";
import { UsageTrend } from "@/components/usage/usage-trend";
import { UsageBreakdown } from "@/components/usage/usage-breakdown";

/**
 * Usage & Limits (Sprint 016) — customer-facing, org-scoped. Every role may view
 * its own organization's usage. NEVER shows Taurus cost or margin (that is the
 * operator view, behind a separate platform-operator gate).
 */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function UsagePage() {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "usage.view")) {
    redirect("/dashboard");
  }

  const overview = await getUsageOverview(getStore(), organization.id);
  const {
    plan,
    interactionUnitLabel,
    interactionsUsed,
    interactionLimit,
    percentUsed,
    unlimited,
    bannerLevel,
    periodEnd,
    byEmployee,
    byChannel,
    trend,
  } = overview;

  const limitLabel = unlimited ? "Unlimited" : interactionLimit.toLocaleString();

  return (
    <div>
      <PageHeader
        eyebrow="Usage & Limits"
        title="Usage"
        description="Your AI Employee interactions for the current billing period."
      />

      {bannerLevel === "reached" ? (
        <Notice>
          You&apos;ve reached your plan&apos;s monthly {interactionUnitLabel.toLowerCase()} limit.{" "}
          <Link href="/dashboard/settings/billing/plans" className="font-medium underline">
            Upgrade your plan
          </Link>{" "}
          to keep your Employees working.
        </Notice>
      ) : bannerLevel === "approaching" ? (
        <Notice>
          You&apos;re approaching your plan&apos;s monthly limit ({percentUsed}% used).{" "}
          <Link href="/dashboard/settings/billing/plans" className="font-medium underline">
            Review plans
          </Link>
          .
        </Notice>
      ) : null}

      <Card className="mt-6 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-taurus-text">{interactionUnitLabel}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-taurus-text">
              {interactionsUsed.toLocaleString()}{" "}
              <span className="text-base font-normal text-taurus-sub">/ {limitLabel}</span>
            </p>
          </div>
          <p className="text-xs text-taurus-faint">
            {plan.name} plan · resets {formatDate(periodEnd)}
          </p>
        </div>
        <div className="mt-4">
          <Progress value={percentUsed} />
        </div>
        <p className="mt-2 text-xs text-taurus-faint">
          {unlimited ? "Unlimited on your plan" : `${percentUsed}% of your monthly limit used`}
        </p>
      </Card>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UsageBreakdown
          title="By AI Employee"
          emptyLabel="No interactions yet this period."
          rows={byEmployee}
          total={interactionsUsed}
        />
        <UsageBreakdown
          title="By channel"
          emptyLabel="No interactions yet this period."
          rows={byChannel}
          total={interactionsUsed}
        />
      </div>

      <h3 className="mt-8 text-sm font-semibold text-taurus-text">Interactions per day</h3>
      <p className="mt-1 text-sm text-taurus-sub">Daily activity across the current period.</p>
      <Card className="mt-4 p-6">
        <UsageTrend points={trend} />
      </Card>
    </div>
  );
}
