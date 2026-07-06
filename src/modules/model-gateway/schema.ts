/**
 * Model Hub validation schemas (Prompt 006B).
 *
 * Friendly, admin-facing validation for the configure / provider / brain forms.
 */

import { z } from "zod";

export const ROUTING_MODES = [
  "auto_balanced",
  "cost_optimized",
  "quality_first",
  "privacy_first",
  "provider_locked",
  "manual",
] as const;

export const PROVIDER_SLUGS = [
  "openai",
  "anthropic",
  "deepseek",
  "moonshot_kimi",
  "groq",
  "google_gemini",
  "fireworks",
  "custom_openai_compatible",
] as const;

export const providerSlugSchema = z.enum(PROVIDER_SLUGS);
export const routingModeSchema = z.enum(ROUTING_MODES);

const optionalModelId = z
  .string()
  .trim()
  .max(200)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

const optionalBudget = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "" || v === null) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  })
  .refine((v) => v === null || v >= 0, { message: "Budget must be zero or more." });

export const organizationModelSettingsSchema = z.object({
  routingMode: routingModeSchema,
  defaultModelId: optionalModelId,
  fallbackModelId: optionalModelId,
  allowedProviderSlugs: z.array(providerSlugSchema).default([]),
  blockedProviderSlugs: z.array(providerSlugSchema).default([]),
  monthlyBudgetUsd: optionalBudget,
  budgetAlertThresholdPercent: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "" || v === null) return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? Math.round(n) : null;
    })
    .refine((v) => v === null || (v >= 0 && v <= 100), {
      message: "Alert threshold must be between 0 and 100.",
    }),
});

/** Employee Brain selection: inherit org default, a simple mode, or advanced. */
export const BRAIN_SELECTIONS = [
  "inherit",
  "economy",
  "balanced",
  "premium",
  "privacy_first",
  "advanced",
] as const;

export const employeeBrainSchema = z
  .object({
    selection: z.enum(BRAIN_SELECTIONS),
    modelId: optionalModelId,
  })
  .refine((v) => v.selection !== "advanced" || !!v.modelId, {
    message: "Please choose a specific model for advanced mode.",
    path: ["modelId"],
  });

export const saveProviderCredentialSchema = z.object({
  providerSlug: providerSlugSchema,
  apiKey: z
    .string()
    .trim()
    .min(8, "Please paste a valid API key (at least 8 characters).")
    .max(400),
});

export type OrganizationModelSettingsValues = z.infer<typeof organizationModelSettingsSchema>;
export type EmployeeBrainValues = z.infer<typeof employeeBrainSchema>;
export type SaveProviderCredentialValues = z.infer<typeof saveProviderCredentialSchema>;
