/**
 * Usage & Limits domain service (Sprint 016) — server only, ORG-SCOPED.
 *
 * Builds the customer-facing usage picture for one organization: interactions
 * vs. plan quota for the current billing period, breakdowns by AI Employee and
 * by channel, a daily trend, and the quota-banner state. Usage is DERIVED from
 * `llm_usage_events` (never a parallel counter) and the quota is read from the
 * billing plan.
 *
 * SECURITY: every read is scoped to the organizationId the caller resolves from
 * the session. This service NEVER exposes Taurus cost or margin — that is the
 * operator view (operator.ts), behind a separate platform-operator gate.
 */

import type { DataStore } from "@/lib/db/store";
import type { AiEmployee, BillingSubscription, LlmUsageEvent } from "@/lib/db/types";
import type { Plan } from "@/modules/billing/plans";
import { ensureSubscription } from "@/modules/billing/service";
import { getPlan } from "@/modules/billing/plans";
import { INTERACTION_UNIT_LABEL } from "@/modules/billing/metadata";
import {
  channelGroupFor,
  CHANNEL_GROUPS,
  CHANNEL_GROUP_LABELS,
  quotaBannerLevel,
  utcDay,
  type ChannelGroup,
  type QuotaBannerLevel,
} from "@/modules/usage/metadata";

export interface UsageBreakdownRow {
  key: string;
  label: string;
  interactions: number;
}

export interface UsageTrendPoint {
  /** UTC calendar day (YYYY-MM-DD). */
  date: string;
  interactions: number;
}

export interface UsageOverview {
  plan: Plan;
  interactionUnitLabel: string;
  periodStart: string;
  periodEnd: string;
  interactionsUsed: number;
  /** Monthly quota from the plan. May be Infinity for an unlimited plan. */
  interactionLimit: number;
  /** 0–100 (0 when unlimited). */
  percentUsed: number;
  unlimited: boolean;
  bannerLevel: QuotaBannerLevel;
  byEmployee: UsageBreakdownRow[];
  byChannel: UsageBreakdownRow[];
  trend: UsageTrendPoint[];
}

interface BuildUsageInput {
  plan: Plan;
  subscription: BillingSubscription;
  events: LlmUsageEvent[];
  employees: AiEmployee[];
  now: Date;
}

/** List the UTC days from `start` to `end` inclusive (for a dense daily trend). */
function daysBetween(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  // Cap at 366 iterations so a bad period can never spin (defensive).
  for (let i = 0; i < 366 && cursor.getTime() <= last; i++) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/**
 * Pure builder — turns a plan, subscription, the period's billable usage events,
 * and the org's employees into the usage overview. Separated from the store so
 * the aggregation math is unit-testable in isolation.
 */
export function buildUsageOverview(input: BuildUsageInput): UsageOverview {
  const { plan, subscription, events, employees, now } = input;
  const limit = plan.entitlements.monthlyInteractionQuota;
  const unlimited = !Number.isFinite(limit);
  const used = events.length;
  const percentUsed = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));

  // --- Breakdown by AI Employee -------------------------------------------
  const employeeName = new Map(employees.map((e) => [e.id, e.name]));
  const byEmployeeCounts = new Map<string, number>();
  for (const e of events) {
    const key = e.employeeId ?? "unattributed";
    byEmployeeCounts.set(key, (byEmployeeCounts.get(key) ?? 0) + 1);
  }
  const byEmployee: UsageBreakdownRow[] = [...byEmployeeCounts.entries()]
    .map(([key, interactions]) => ({
      key,
      label: key === "unattributed" ? "Unattributed" : (employeeName.get(key) ?? "Removed Employee"),
      interactions,
    }))
    .sort((a, b) => b.interactions - a.interactions);

  // --- Breakdown by channel -----------------------------------------------
  const byChannelCounts = new Map<ChannelGroup, number>();
  for (const e of events) {
    const group = channelGroupFor(e.channelType);
    byChannelCounts.set(group, (byChannelCounts.get(group) ?? 0) + 1);
  }
  const byChannel: UsageBreakdownRow[] = CHANNEL_GROUPS.map((group) => ({
    key: group,
    label: CHANNEL_GROUP_LABELS[group],
    interactions: byChannelCounts.get(group) ?? 0,
  })).filter((row) => row.interactions > 0);

  // --- Daily trend across the period --------------------------------------
  const periodStart = new Date(subscription.currentPeriodStart);
  const trendEnd = now < new Date(subscription.currentPeriodEnd) ? now : new Date(subscription.currentPeriodEnd);
  const dayCounts = new Map<string, number>();
  for (const e of events) {
    const day = utcDay(e.createdAt);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  const trend: UsageTrendPoint[] = daysBetween(periodStart, trendEnd).map((date) => ({
    date,
    interactions: dayCounts.get(date) ?? 0,
  }));

  return {
    plan,
    interactionUnitLabel: INTERACTION_UNIT_LABEL,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
    interactionsUsed: used,
    interactionLimit: limit,
    percentUsed,
    unlimited,
    bannerLevel: quotaBannerLevel(used, limit),
    byEmployee,
    byChannel,
    trend,
  };
}

/** Gather the org's usage overview from the store (org-scoped). */
export async function getUsageOverview(
  store: DataStore,
  organizationId: string,
  now: Date = new Date(),
): Promise<UsageOverview> {
  const subscription = await ensureSubscription(store, organizationId);
  const plan = getPlan(subscription.planId);
  const [events, employees] = await Promise.all([
    store.listBillableUsageEventsSince(organizationId, subscription.currentPeriodStart),
    store.listEmployees(organizationId),
  ]);
  return buildUsageOverview({ plan, subscription, events, employees, now });
}
