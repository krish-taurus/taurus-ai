import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { getOrganizationPlan } from "@/modules/billing/service";
import { getBillingProvider, isSimulatedBilling } from "@/modules/billing/providers";
import { PLANS_IN_ORDER } from "@/modules/billing/plans";
import { SIMULATED_BILLING_NOTICE } from "@/modules/billing/metadata";
import { ChoosePlanButton } from "@/components/billing/choose-plan-button";
import { Badge, buttonClasses, Card, Notice, PageHeader } from "@/components/ui";

export default async function BillingPlansPage() {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "billing.view")) {
    redirect("/dashboard");
  }
  const canManage = hasPermission(membership.role, "billing.manage");

  // Touch the provider so simulated mode is resolved consistently with actions.
  getBillingProvider();
  const simulated = isSimulatedBilling();
  const currentPlan = await getOrganizationPlan(getStore(), organization.id);

  return (
    <div>
      <PageHeader
        eyebrow="Billing"
        title="Plans"
        description="Pick the plan that fits your team. Change or cancel anytime."
        action={
          <Link href="/dashboard/settings/billing" className={buttonClasses("secondary")}>
            Back to Billing
          </Link>
        }
      />

      {simulated ? <Notice>{SIMULATED_BILLING_NOTICE}</Notice> : null}

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {PLANS_IN_ORDER.map((plan) => {
          const isCurrent = plan.id === currentPlan.id;
          return (
            <Card key={plan.id} className="flex flex-col p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-taurus-text">{plan.name}</h2>
                {isCurrent ? <Badge tone="solid">Current plan</Badge> : null}
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-taurus-text">
                {plan.isFree ? "Free" : `$${plan.monthlyPriceUsd}`}
                {plan.isFree ? null : (
                  <span className="text-sm font-normal text-taurus-faint"> / month</span>
                )}
              </p>
              <p className="mt-2 text-sm text-taurus-sub">{plan.tagline}</p>

              <ul className="mt-4 flex-1 space-y-2">
                {plan.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2 text-sm text-taurus-sub">
                    <span aria-hidden className="mt-px text-taurus-text">
                      ✓
                    </span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className={buttonClasses("outline", "md", "w-full")}
                  >
                    Your current plan
                  </button>
                ) : canManage ? (
                  <ChoosePlanButton
                    planId={plan.id}
                    label={`Choose ${plan.name}`}
                    variant={plan.isFree ? "secondary" : "primary"}
                  />
                ) : (
                  <p className="text-center text-xs text-taurus-faint">
                    Ask an owner or admin to change the plan.
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
