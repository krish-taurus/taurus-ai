import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { getOrganizationPlan } from "@/modules/billing/service";
import { planIncludesFeature } from "@/modules/billing/entitlements";
import { PerformanceService, PerformanceNotFoundError } from "@/modules/performance";
import { isDeterministicMethod } from "@/modules/performance/types";
import { Card, PageHeader } from "@/components/ui";
import { PerformanceLocked } from "@/components/performance/performance-locked";
import { AddCaseForm, AddCriterionForm, RunReviewForm } from "@/components/performance/forms";

export default async function ScorecardPage({ params }: { params: { scorecardId: string } }) {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "performance.view")) redirect("/dashboard");

  const store = getStore();
  const plan = await getOrganizationPlan(store, organization.id);
  if (!planIncludesFeature(plan, "performanceReview")) return <PerformanceLocked />;

  const ctx = { organizationId: organization.id, userId: user.id, role: membership.role };
  const canManage = hasPermission(membership.role, "performance.manage");

  let detail;
  try {
    detail = await PerformanceService.getScorecardDetail(store, ctx, params.scorecardId);
  } catch (err) {
    if (err instanceof PerformanceNotFoundError) notFound();
    throw err;
  }
  const employees = (await store.listEmployees(organization.id))
    .filter((e) => e.status !== "archived")
    .map((e) => ({ id: e.id, name: e.name }));
  const nextPosition = detail.criteria.length;

  return (
    <div>
      <PageHeader
        eyebrow="Performance"
        title={detail.scorecard.name}
        description={detail.scorecard.description ?? "The qualities this scorecard measures."}
        action={
          <Link href="/dashboard/performance" className="text-sm text-taurus-sub hover:text-taurus-text">
            ← All scorecards
          </Link>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-taurus-text">Criteria</h2>
          {detail.criteria.length === 0 ? (
            <p className="mt-2 text-sm text-taurus-faint">No criteria yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {detail.criteria.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-2">
                  <span className="text-taurus-text">{c.label}</span>
                  <span className="text-xs text-taurus-faint">
                    weight {c.weight} · {isDeterministicMethod(c.method) ? "free" : "reviewed"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-semibold text-taurus-text">Review cases</h2>
          {detail.cases.length === 0 ? (
            <p className="mt-2 text-sm text-taurus-faint">No cases yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {detail.cases.map((c) => (
                <li key={c.id} className="text-taurus-text">
                  {c.name}
                  <span className="mt-0.5 block text-xs text-taurus-sub line-clamp-2">{c.situation}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {canManage ? (
        <>
          <Card className="mt-6 p-6">
            <h2 className="text-sm font-semibold text-taurus-text">Add a criterion</h2>
            <div className="mt-4">
              <AddCriterionForm scorecardId={detail.scorecard.id} position={nextPosition} />
            </div>
          </Card>

          <Card className="mt-6 p-6">
            <h2 className="text-sm font-semibold text-taurus-text">Add a review case</h2>
            <div className="mt-4">
              <AddCaseForm scorecardId={detail.scorecard.id} />
            </div>
          </Card>

          <Card className="mt-6 p-6">
            <h2 className="text-sm font-semibold text-taurus-text">Run this review</h2>
            <p className="mt-1 text-sm text-taurus-sub">
              Runs against the AI Employee&apos;s current published DNA, so results are reproducible.
            </p>
            <div className="mt-4">
              {employees.length === 0 || detail.cases.length === 0 ? (
                <p className="text-sm text-taurus-faint">
                  Add at least one review case and have an AI Employee with published DNA to run a review.
                </p>
              ) : (
                <RunReviewForm scorecardId={detail.scorecard.id} employees={employees} />
              )}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
