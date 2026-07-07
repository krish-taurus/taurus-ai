/**
 * Platform-operator cost/margin (Sprint 016) — server only, PLATFORM-INTERNAL.
 *
 * Margin is a TAURUS business metric, not a tenant metric. Everything here is
 * gated by `isPlatformOperator`, an allowlist in a SERVER-ONLY env var that is
 * NOT an org role and can never be reached by a normal customer. The cross-tenant
 * aggregation below is deliberate and lives ONLY behind that gate; every
 * tenant-facing query elsewhere stays strictly organization-scoped.
 */

import type { DataStore } from "@/lib/db/store";
import type { BillingSubscription, ModelAccessMode, UsageCostAggregateRow } from "@/lib/db/types";
import type { Plan, PlanId } from "@/modules/billing/plans";
import { getPlan } from "@/modules/billing/plans";
import { getServerEnv } from "@/lib/env/env";
import { managedInteractionPriceUsd } from "@/modules/usage/model-pricing";

/**
 * Is this user a platform operator? Reads the SERVER-ONLY comma-separated
 * allowlist. Deny-by-default: an empty allowlist or empty user id → false. Never
 * consult an org role here — operator access is orthogonal to tenancy.
 */
export function isPlatformOperator(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const raw = getServerEnv().PLATFORM_OPERATOR_USER_IDS ?? "";
  const allow = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allow.includes(userId);
}

/** Default share of plan price above which a MANAGED tenant is "margin at risk". */
const DEFAULT_AT_RISK_COST_SHARE = 0.33; // below a 3× markup — the floor of the band.

function atRiskCostShare(): number {
  const raw = process.env.MARGIN_AT_RISK_COST_SHARE;
  if (!raw) return DEFAULT_AT_RISK_COST_SHARE;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 && value < 1 ? value : DEFAULT_AT_RISK_COST_SHARE;
}

export interface OrgMarginRow {
  organizationId: string;
  organizationName: string;
  planId: PlanId;
  planName: string;
  accessMode: ModelAccessMode;
  interactionCount: number;
  managedInteractionCount: number;
  byokInteractionCount: number;
  revenueUsd: number;
  costUsd: number;
  marginUsd: number;
  /** (revenue - cost) / revenue. Null when revenue is 0 (undefined margin %). */
  marginPct: number | null;
  /** revenue / cost. Null when cost is 0 (effectively infinite markup). */
  markupMultiple: number | null;
  atRisk: boolean;
}

export interface PlanMarginRow {
  planId: PlanId;
  planName: string;
  orgCount: number;
  revenueUsd: number;
  costUsd: number;
  marginUsd: number;
  marginPct: number | null;
}

export interface MarginTotals {
  orgCount: number;
  interactionCount: number;
  revenueUsd: number;
  costUsd: number;
  marginUsd: number;
  marginPct: number | null;
}

export interface MarginReport {
  periodStart: string;
  periodEnd: string;
  atRiskCostSharePercent: number;
  /** Managed per-interaction sell price (defined + displayed this sprint; charged in 017). */
  managedInteractionPriceUsd: number;
  totals: MarginTotals;
  byPlan: PlanMarginRow[];
  byOrganization: OrgMarginRow[];
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function marginPctOf(revenue: number, cost: number): number | null {
  if (revenue <= 0) return null;
  return Math.round(((revenue - cost) / revenue) * 100);
}

interface OrgInfo {
  name: string;
  accessMode: ModelAccessMode;
}

interface BuildMarginInput {
  subscriptions: BillingSubscription[];
  orgInfo: Map<string, OrgInfo>;
  aggregates: Map<string, UsageCostAggregateRow>;
  periodStart: string;
  periodEnd: string;
}

/**
 * Pure margin math — revenue from active subscriptions, serving cost from the
 * usage aggregate, per org + per plan + in aggregate. Separated from the store
 * so revenue/cost/margin/markup and the at-risk flag are unit-testable.
 */
export function buildMarginReport(input: BuildMarginInput): MarginReport {
  const share = atRiskCostShare();
  const byOrganization: OrgMarginRow[] = [];

  for (const sub of input.subscriptions) {
    // Canceled subscriptions earn no revenue and are excluded.
    if (sub.status === "canceled") continue;
    const plan: Plan = getPlan(sub.planId);
    const info = input.orgInfo.get(sub.organizationId);
    const agg = input.aggregates.get(sub.organizationId);

    const revenueUsd = plan.monthlyPriceUsd;
    const costUsd = round(agg?.totalCostUsd ?? 0);
    const marginUsd = round(revenueUsd - costUsd);
    // At-risk applies to MANAGED serving cost: a tenant whose cost exceeds the
    // configured share of its plan price (BYOK cost is 0, so BYOK never trips it).
    const atRisk = costUsd > share * revenueUsd && costUsd > 0;

    byOrganization.push({
      organizationId: sub.organizationId,
      organizationName: info?.name ?? "Unknown organization",
      planId: plan.id,
      planName: plan.name,
      accessMode: info?.accessMode ?? "managed",
      interactionCount: agg?.interactionCount ?? 0,
      managedInteractionCount: agg?.managedInteractionCount ?? 0,
      byokInteractionCount: agg?.byokInteractionCount ?? 0,
      revenueUsd,
      costUsd,
      marginUsd,
      marginPct: marginPctOf(revenueUsd, costUsd),
      markupMultiple: costUsd > 0 ? round(revenueUsd / costUsd) : null,
      atRisk,
    });
  }

  // Sort loss-leaders first: at-risk, then lowest margin.
  byOrganization.sort((a, b) => {
    if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
    return a.marginUsd - b.marginUsd;
  });

  // --- Per-plan rollup ----------------------------------------------------
  const planMap = new Map<PlanId, PlanMarginRow>();
  for (const row of byOrganization) {
    const existing =
      planMap.get(row.planId) ??
      ({
        planId: row.planId,
        planName: row.planName,
        orgCount: 0,
        revenueUsd: 0,
        costUsd: 0,
        marginUsd: 0,
        marginPct: null,
      } satisfies PlanMarginRow);
    existing.orgCount += 1;
    existing.revenueUsd = round(existing.revenueUsd + row.revenueUsd);
    existing.costUsd = round(existing.costUsd + row.costUsd);
    existing.marginUsd = round(existing.marginUsd + row.marginUsd);
    planMap.set(row.planId, existing);
  }
  const byPlan = [...planMap.values()].map((p) => ({
    ...p,
    marginPct: marginPctOf(p.revenueUsd, p.costUsd),
  }));

  // --- Aggregate totals ---------------------------------------------------
  const revenueUsd = round(byOrganization.reduce((s, r) => s + r.revenueUsd, 0));
  const costUsd = round(byOrganization.reduce((s, r) => s + r.costUsd, 0));
  const interactionCount = byOrganization.reduce((s, r) => s + r.interactionCount, 0);

  return {
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    atRiskCostSharePercent: Math.round(share * 100),
    managedInteractionPriceUsd: managedInteractionPriceUsd("mid"),
    totals: {
      orgCount: byOrganization.length,
      interactionCount,
      revenueUsd,
      costUsd,
      marginUsd: round(revenueUsd - costUsd),
      marginPct: marginPctOf(revenueUsd, costUsd),
    },
    byPlan,
    byOrganization,
  };
}

/**
 * Build the operator margin report from the store. CROSS-TENANT — callers MUST
 * verify `isPlatformOperator` first (the operator route does).
 */
export async function getMarginReport(
  store: DataStore,
  options: { since: Date; until?: Date } = { since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
): Promise<MarginReport> {
  const until = options.until ?? new Date();
  const sinceIso = options.since.toISOString();

  const [subscriptions, aggregateRows] = await Promise.all([
    store.listAllBillingSubscriptions(),
    store.aggregateUsageCostsSince(sinceIso),
  ]);

  const aggregates = new Map(aggregateRows.map((r) => [r.organizationId, r]));

  const orgIds = [...new Set(subscriptions.map((s) => s.organizationId))];
  const orgs = await Promise.all(orgIds.map((id) => store.getOrganizationById(id)));
  const orgInfo = new Map<string, OrgInfo>();
  for (const org of orgs) {
    if (org) orgInfo.set(org.id, { name: org.name, accessMode: org.modelAccessMode });
  }

  return buildMarginReport({
    subscriptions,
    orgInfo,
    aggregates,
    periodStart: sinceIso,
    periodEnd: until.toISOString(),
  });
}
