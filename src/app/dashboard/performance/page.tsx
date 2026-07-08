import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { getOrganizationPlan } from "@/modules/billing/service";
import { planIncludesFeature } from "@/modules/billing/entitlements";
import { PerformanceService } from "@/modules/performance";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PerformanceLocked } from "@/components/performance/performance-locked";
import { NewScorecardForm } from "@/components/performance/forms";

/**
 * Performance Review overview (Sprint 018) — Growth+ only. Lists scorecards and,
 * for owner/admin/builder, lets them create a new one. Starter orgs see a locked
 * state (server-side enforcement is separate, in the service).
 */
export default async function PerformanceOverviewPage() {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "performance.view")) redirect("/dashboard");

  const store = getStore();
  const plan = await getOrganizationPlan(store, organization.id);
  if (!planIncludesFeature(plan, "performanceReview")) return <PerformanceLocked />;

  const ctx = { organizationId: organization.id, userId: user.id, role: membership.role };
  const canManage = hasPermission(membership.role, "performance.manage");
  const scorecards = await PerformanceService.listScorecards(store, ctx);

  return (
    <div>
      <PageHeader
        eyebrow="Performance"
        title="Performance Review"
        description="Score your AI Employees against real situations and track quality over time."
      />

      <h2 className="mt-6 text-sm font-semibold text-taurus-text">Scorecards</h2>
      {scorecards.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="No scorecards yet."
            description={
              canManage
                ? "Create a scorecard to measure how well an AI Employee handles real situations."
                : "Ask an owner, admin, or builder to create a scorecard for your AI Employees."
            }
          />
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {scorecards.map((s) => (
            <li key={s.id}>
              <Link
                href={`/dashboard/performance/${s.id}`}
                className="block rounded-lg border border-taurus-line px-4 py-3 hover:bg-taurus-muted/50"
              >
                <span className="text-sm font-medium text-taurus-text">{s.name}</span>
                {s.description ? (
                  <span className="mt-0.5 block text-xs text-taurus-sub">{s.description}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <Card className="mt-8 p-6">
          <h2 className="text-sm font-semibold text-taurus-text">New scorecard</h2>
          <p className="mt-1 text-sm text-taurus-sub">
            A scorecard is the set of qualities you measure an AI Employee on. Free grading methods
            (includes text, exact, pattern, doesn&apos;t refuse) run with no model cost.
          </p>
          <div className="mt-4">
            <NewScorecardForm />
          </div>
        </Card>
      ) : (
        <p className="mt-6 text-xs text-taurus-faint">
          Only owners, admins, and builders can create scorecards or run reviews.
        </p>
      )}
    </div>
  );
}
