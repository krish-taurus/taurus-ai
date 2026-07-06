/**
 * Channel validation schemas (Prompt 008).
 */

import { z } from "zod";
import { normalizeDomain } from "@/modules/channels/domains";

export const createWebChannelSchema = z.object({
  name: z.string().trim().min(1).max(80).default("Website"),
  welcomeMessage: z.string().trim().max(500).optional().or(z.literal("")),
});

/** Parse a textarea of domains (newline/comma separated) into a clean list. */
export function parseDomains(raw: string): string[] {
  const parts = raw
    .split(/[\n,]+/)
    .map((d) => normalizeDomain(d))
    .filter(Boolean);
  return Array.from(new Set(parts)).slice(0, 50);
}

export const updateChannelSchema = z.object({
  name: z.string().trim().min(1, "Please name this channel.").max(80),
  welcomeMessage: z.string().trim().max(500).optional().or(z.literal("")),
  allowedDomains: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  appearance: z.object({
    theme: z.enum(["dark", "light"]),
    position: z.enum(["bottom-right", "bottom-left"]),
    launcherLabel: z.string().trim().min(1).max(60),
    employeeDisplayName: z.string().trim().min(1).max(80),
    accentStyle: z.enum(["mono", "solid"]),
    showSources: z.boolean(),
    collectVisitorEmail: z.boolean(),
    brandName: z.string().trim().max(80).nullable(),
  }),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(240),
  rateLimitPerDay: z.coerce.number().int().min(1).max(100_000),
});

export type CreateWebChannelValues = z.infer<typeof createWebChannelSchema>;
export type UpdateChannelValues = z.infer<typeof updateChannelSchema>;
