import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireUser } from "@/lib/security/guards";
import { isPlatformOperator, getMarginReport } from "@/modules/usage/operator";
import { Badge, Card, PageHeader } from "@/components/ui";

/**
 * Operator margin view (Sprint 016) — PLATFORM-INTERNAL, strictly gated.
 *
 * Revenue, serving cost, gross margin, and markup per plan and per organization,
 * plus the "margin at risk" flag. Reachable ONLY by a platform operator (the
 * server-only allowlist). A normal user — including an org owner — gets 404. The
 * cross-tenant aggregation lives ONLY behind this gate.
 */

const PERIOD_OPTIONS = [7, 30, 90] as const;

function usd(value: number): string {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function pct(value: number | null): string {
  return value == null ? "—" : `${value}%`;
}

function markup(value: number | null): string {
  return value == null ? "—" : `${value}×`;
}

export default async function OperatorMarginPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const user = await requireUser();
  // Platform-operator gate — never an org role. A normal user gets not-found so
  // the route's existence is not even revealed.
  if (!isPlatformOperator(user.id)) notFound();

  const days = PERIOD_OPTIONS.includes(Number(searchParams.days) as (typeof PERIOD_OPTIONS)[number])
    ? Number(searchParams.days)
    : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const report = await getMarginReport(getStore(), { since });
  const { totals, byPlan, byOrganization } = report;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        eyebrow="Platform operator"
        title="Cost & Margin"
        description="Revenue, serving cost, and gross margin across all organizations. Platform-internal."
      />

      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className="text-taurus-faint">Period:</span>
        {PERIOD_OPTIONS.map((d) => (
          <Link
            key={d}
            href={`/operator/margin?days=${d}`}
            className={
              d === days
                ? "rounded-md bg-taurus-muted px-2 py-1 font-medium text-taurus-text"
                : "rounded-md px-2 py-1 text-taurus-sub hover:bg-taurus-muted/60"
            }
          >
            {d} days
          </Link>
        ))}
      </div>

      {/* Aggregate totals */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Revenue (blended)" value={usd(totals.revenueUsd)} sub={`incl. ${usd(totals.overageRevenueUsd)} overage`} />
        <Stat label="Serving cost" value={usd(totals.costUsd)} sub={`incl. ${usd(totals.overageCostUsd)} overage`} />
        <Stat label="Gross margin" value={usd(totals.marginUsd)} sub={pct(totals.marginPct)} />
        <Stat label="Overage revenue" value={usd(totals.overageRevenueUsd)} sub={`vs ${usd(totals.overageCostUsd)} cost`} />
        <Stat label="Organizations" value={String(totals.orgCount)} sub={`${totals.interactionCount.toLocaleString()} interactions`} />
      </div>

      <p className="mt-3 text-xs text-taurus-faint">
        Managed sell price (defined, not yet charged): {usd(report.managedInteractionPriceUsd)} /
        interaction · &quot;At risk&quot; = managed serving cost above {report.atRiskCostSharePercent}% of plan
        price (below a {Math.round(100 / report.atRiskCostSharePercent)}× markup).
      </p>

      {/* Per plan */}
      <h2 className="mt-8 text-sm font-semibold text-taurus-text">By plan</h2>
      <Card className="mt-3 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-taurus-line text-xs text-taurus-faint">
            <tr>
              <Th>Plan</Th>
              <Th>Orgs</Th>
              <Th align="right">Revenue</Th>
              <Th align="right">Cost</Th>
              <Th align="right">Margin</Th>
              <Th align="right">Margin %</Th>
            </tr>
          </thead>
          <tbody>
            {byPlan.map((p) => (
              <tr key={p.planId} className="border-b border-taurus-line/60 last:border-0">
                <Td>{p.planName}</Td>
                <Td>{p.orgCount}</Td>
                <Td align="right">{usd(p.revenueUsd)}</Td>
                <Td align="right">{usd(p.costUsd)}</Td>
                <Td align="right">{usd(p.marginUsd)}</Td>
                <Td align="right">{pct(p.marginPct)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Per organization */}
      <h2 className="mt-8 text-sm font-semibold text-taurus-text">By organization</h2>
      <Card className="mt-3 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-taurus-line text-xs text-taurus-faint">
            <tr>
              <Th>Organization</Th>
              <Th>Plan</Th>
              <Th>Access</Th>
              <Th align="right">Interactions</Th>
              <Th align="right">Revenue</Th>
              <Th align="right">Overage</Th>
              <Th align="right">Cost</Th>
              <Th align="right">Margin %</Th>
              <Th align="right">Markup</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {byOrganization.map((o) => (
              <tr key={o.organizationId} className="border-b border-taurus-line/60 last:border-0">
                <Td>{o.organizationName}</Td>
                <Td>{o.planName}</Td>
                <Td>
                  <Badge tone="soft">{o.accessMode === "byok" ? "BYOK" : "Managed"}</Badge>
                </Td>
                <Td align="right">{o.interactionCount.toLocaleString()}</Td>
                <Td align="right">{usd(o.revenueUsd)}</Td>
                <Td align="right">
                  {o.overageQuantity > 0 ? (
                    <>
                      {usd(o.overageRevenueUsd)}
                      <span className="block text-xs text-taurus-faint">
                        {o.overageQuantity.toLocaleString()} extra
                      </span>
                    </>
                  ) : (
                    <span className="text-taurus-faint">—</span>
                  )}
                </Td>
                <Td align="right">{usd(o.costUsd)}</Td>
                <Td align="right">{pct(o.marginPct)}</Td>
                <Td align="right">{markup(o.markupMultiple)}</Td>
                <Td>
                  {o.atRisk ? (
                    <Badge tone="solid">Margin at risk</Badge>
                  ) : (
                    <span className="text-xs text-taurus-faint">OK</span>
                  )}
                </Td>
              </tr>
            ))}
            {byOrganization.length === 0 ? (
              <tr>
                <Td>No organizations yet.</Td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-taurus-faint">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-taurus-text">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-taurus-sub">{sub}</p> : null}
    </Card>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th className={`px-4 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <td className={`px-4 py-2 tabular-nums text-taurus-text ${align === "right" ? "text-right" : ""}`}>
      {children}
    </td>
  );
}
