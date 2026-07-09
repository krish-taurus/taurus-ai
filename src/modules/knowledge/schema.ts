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

export const createDatabaseSourceSchema = z.object({
  name: knowledgeNameSchema,
  description: knowledgeDescriptionSchema,
  visibility: knowledgeVisibilitySchema.default("organization"),
  kind: z.enum(["postgres", "mysql"], {
    errorMap: () => ({ message: "Choose a supported database." }),
  }),
  connectionString: z
    .string()
    .trim()
    .min(1, "Enter your database connection string.")
    .max(4000)
    .refine((v) => /^(postgres(ql)?|mysql):\/\//i.test(v), {
      message: "Enter a PostgreSQL (postgres://…) or MySQL (mysql://…) connection string.",
    }),
  query: z.string().trim().min(1, "Enter a read-only SQL query.").max(20_000),
})
  .refine(
    (v) =>
      (v.kind === "postgres" && /^postgres(ql)?:\/\//i.test(v.connectionString)) ||
      (v.kind === "mysql" && /^mysql:\/\//i.test(v.connectionString)),
    { message: "The connection string doesn’t match the selected database.", path: ["connectionString"] },
  );

export const createGoogleDriveSourceSchema = z.object({
  name: knowledgeNameSchema,
  description: knowledgeDescriptionSchema,
  visibility: knowledgeVisibilitySchema.default("organization"),
  link: z
    .string()
    .trim()
    .min(1, "Paste a Google Drive file or folder link."),
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
export type CreateDatabaseSourceValues = z.infer<typeof createDatabaseSourceSchema>;
export type CreateGoogleDriveSourceValues = z.infer<typeof createGoogleDriveSourceSchema>;
export type CreateFileSourceMetaValues = z.infer<typeof createFileSourceMetaSchema>;
export type UpdateKnowledgeSourceValues = z.infer<typeof updateKnowledgeSourceSchema>;
