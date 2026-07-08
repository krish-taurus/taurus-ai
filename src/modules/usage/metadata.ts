/**
 * Usage & Limits presentation helpers (Sprint 016) — pure.
 *
 * Small, dependency-free helpers shared by the usage service + UI: how channels
 * group into customer-facing buckets, and the quota banner thresholds. Kept free
 * of Next.js and DataStore.
 */

import type { ChannelType } from "@/lib/db/types";

/** Customer-facing channel groups for the usage breakdown. */
export const CHANNEL_GROUPS = ["web", "messaging", "email", "voice", "other"] as const;
export type ChannelGroup = (typeof CHANNEL_GROUPS)[number];

export const CHANNEL_GROUP_LABELS: Record<ChannelGroup, string> = {
  web: "Web",
  messaging: "WhatsApp / SMS",
  email: "Email",
  voice: "Voice",
  other: "Other",
};

/** Map a raw channel type (or null) to its customer-facing group. */
export function channelGroupFor(channelType: ChannelType | null | undefined): ChannelGroup {
  switch (channelType) {
    case "hosted_chat":
    case "website_widget":
    case "iframe_embed":
    case "public_api":
      return "web";
    case "whatsapp":
    case "sms":
      return "messaging";
    case "email":
      return "email";
    case "phone_call":
      return "voice";
    default:
      // slack / teams / instagram_dm / unknown / null — grouped as Other so the
      // breakdown always sums to the total.
      return "other";
  }
}

/** Quota banner state for the usage dashboard. */
export type QuotaBannerLevel = "ok" | "approaching" | "reached";

/** Percent (0–100+) at which the "approaching your limit" banner appears. */
export const QUOTA_APPROACHING_PERCENT = 80;

/**
 * Banner level from usage vs. quota. "approaching" at 80%, "reached" at 100%.
 * An unlimited quota (Infinity) is always "ok".
 */
export function quotaBannerLevel(used: number, limit: number): QuotaBannerLevel {
  if (!Number.isFinite(limit) || limit <= 0) return "ok";
  if (used >= limit) return "reached";
  if ((used / limit) * 100 >= QUOTA_APPROACHING_PERCENT) return "approaching";
  return "ok";
}

/** UTC calendar day (YYYY-MM-DD) of an ISO timestamp, for the daily trend. */
export function utcDay(iso: string): string {
  return iso.slice(0, 10);
}
