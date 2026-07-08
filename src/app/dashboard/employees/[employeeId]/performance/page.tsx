import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { getOrganizationPlan } from "@/modules/billing/service";
import { planIncludesFeature } from "@/modules/billing/entitlements";
import { PerformanceService } from "@/modules/performance";
import { Badge, Card, PageHeader } from "@/components/ui";
import { PerformanceLocked } from "@/components/performance/performance-locked";
import { RunReviewForm } from "@/components/performance/forms";

function pct(score: number | null): string {
  return score == null ? "—" : `${Math.round(score * 100)}%`;
}

export default async function EmployeePerformancePage({
  params,
  searchParams,
}: {
  params: { employeeId: string };
  searchParams: { run?: string };
}) {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "performance.view")) redirect("/dashboard");

  const store = getStore();
  const plan = await getOrganizationPlan(store, organization.id);
  if (!planIncludesFeature(plan, "performanceReview")) return <PerformanceLocked />;

  const employee = await store.getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  const ctx = { organizationId: organization.id, userId: user.id, role: membership.role };
  const canManage = hasPermission(membership.role, "performance.manage");
  const [runs, trend, scorecards] = await Promise.all([
    PerformanceService.listRuns(store, ctx, { employeeId: params.employeeId }),
    PerformanceService.getTrend(store, ctx, params.employeeId),
    PerformanceService.listScorecards(store, ctx),
  ]);

  // The run to show: the one in the URL, else the most recent completed run.
  const selectedRunId = searchParams.run ?? runs.find((r) => r.status === "completed")?.id;
  const outcome = selectedRunId
    ? await PerformanceService.getRunOutcome(store, ctx, selectedRunId).catch(() => null)
    : null;
  const maxScore = trend.reduce((m, p) => Math.max(m, p.overallScore), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Performance"
        title={`${employee.name} — Performance`}
        description="How this AI Employee scores against your scorecards, and how it's improving."
        action={
          <Link
            href={`/dashboard/employees/${employee.id}`}
            className="text-sm text-taurus-sub hover:text-taurus-text"
          >
            ← Back to Employee
          </Link>
        }
      />

      {/* Trend */}
      <Card className="mt-6 p-6">
        <h2 className="text-sm font-semibold text-taurus-text">Score over time</h2>
        {trend.length === 0 ? (
          <p className="mt-2 text-sm text-taurus-faint">No completed reviews yet.</p>
        ) : (
          <div className="mt-4 flex h-28 items-end gap-2">
            {trend.map((p) => (
              <div
                key={p.runId}
                className="flex flex-1 flex-col items-center justify-end gap-1"
                title={`DNA v${p.dnaVersionNumber}: ${pct(p.overallScore)} (${Math.round(p.passRate * 100)}% cases passed)`}
              >
                <div
                  className="w-full rounded-t bg-taurus-text"
                  style={{ height: `${maxScore > 0 ? Math.max(4, (p.overallScore / maxScore) * 100) : 0}%` }}
                />
                <span className="text-[10px] text-taurus-faint">v{p.dnaVersionNumber}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Run a review */}
      {canManage && scorecards.length > 0 ? (
        <Card className="mt-6 p-6">
          <h2 className="text-sm font-semibold text-taurus-text">Run a review</h2>
          <div className="mt-4 flex flex-col gap-3">
            {scorecards.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-taurus-text">{s.name}</span>
                <RunReviewForm scorecardId={s.id} employees={[]} fixedEmployeeId={employee.id} />
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Selected run results */}
      {outcome ? (
        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-taurus-text">
              Latest review · DNA v{outcome.run.dnaVersionNumber}
            </h2>
            <span className="text-sm text-taurus-sub">
              Overall {pct(outcome.run.overallScore)} · {outcome.run.passedCases}/{outcome.run.totalCases} cases passed
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {outcome.results.map((r) => (
              <Card key={r.id} className="p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-taurus-text">Case score {pct(r.score)}</span>
                  <Badge tone={r.passed ? "solid" : "outline"}>{r.passed ? "Passed" : "Needs work"}</Badge>
                </div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {r.criterionScores.map((c) => (
                    <li key={c.criterionId} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-taurus-sub">
                        {c.passed ? "✓" : "✕"} {c.label}
                      </span>
                      <span className="text-right text-xs text-taurus-faint">{c.reason}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      ) : runs.length > 0 ? (
        <p className="mt-6 text-sm text-taurus-faint">Select a completed run to see its results.</p>
      ) : null}
    </div>
  );
}
