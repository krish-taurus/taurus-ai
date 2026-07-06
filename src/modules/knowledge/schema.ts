/**
 * Knowledge Vault validation schemas (Prompt 006).
 *
 * Friendly, business-facing validation for the Add Knowledge flows. File bytes
 * are validated separately in the service (type/size/empty checks).
 */

import { z } from "zod";

export const knowledgeNameSchema = z
  .string()
  .trim()
  .min(2, "Please give this knowledge a name (at least 2 characters).")
  .max(200);

export const knowledgeDescriptionSchema = z.string().trim().max(2000).optional().or(z.literal(""));

export const knowledgeVisibilitySchema = z.enum(["private", "organization"], {
  errorMap: () => ({ message: "Please choose who can see this knowledge." }),
});

export const createTextSourceSchema = z.object({
  name: knowledgeNameSchema,
  description: knowledgeDescriptionSchema,
  visibility: knowledgeVisibilitySchema.default("organization"),
  text: z.string().trim().min(1, "Please enter some text to save.").max(200_000),
});

export const createUrlSourceSchema = z.object({
  name: knowledgeNameSchema,
  description: knowledgeDescriptionSchema,
  visibility: knowledgeVisibilitySchema.default("organization"),
  url: z
    .string()
    .trim()
    .min(1, "Please enter a website address.")
    .url("Please enter a valid website address.")
    .refine((value) => /^https?:\/\//i.test(value), {
      message: "Only http and https website addresses are allowed.",
    }),
});

export const createFileSourceMetaSchema = z.object({
  name: knowledgeNameSchema,
  description: knowledgeDescriptionSchema,
  visibility: knowledgeVisibilitySchema.default("organization"),
});

export const updateKnowledgeSourceSchema = z.object({
  name: knowledgeNameSchema,
  description: knowledgeDescriptionSchema,
  visibility: knowledgeVisibilitySchema,
});

export type CreateTextSourceValues = z.infer<typeof createTextSourceSchema>;
export type CreateUrlSourceValues = z.infer<typeof createUrlSourceSchema>;
export type CreateFileSourceMetaValues = z.infer<typeof createFileSourceMetaSchema>;
export type UpdateKnowledgeSourceValues = z.infer<typeof updateKnowledgeSourceSchema>;
