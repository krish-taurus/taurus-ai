import { z } from "zod";

/**
 * Environment validation for Taurus AI.
 *
 * All environment access should go through this module so that missing or
 * malformed configuration fails fast with a clear message instead of causing
 * confusing runtime errors deep in the app.
 *
 * In Prompt 001 the app runs without a database or provider keys, so most
 * variables are optional. Later prompts will tighten these rules (e.g. require
 * DATABASE_URL once the DB layer is wired up).
 *
 * SECURITY: Only variables prefixed with `NEXT_PUBLIC_` are exposed to the
 * browser. Server secrets (AI_PROVIDER_API_KEY, AUTH_SECRET, DATABASE_URL) are
 * validated here but must never be imported into client components.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional().or(z.literal("")),
  AUTH_SECRET: z.string().optional().or(z.literal("")),
  AI_PROVIDER_API_KEY: z.string().optional().or(z.literal("")),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

/**
 * Validate a set of environment variables against a schema.
 * Throws an aggregated, readable error listing every invalid key.
 */
function validate<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n` +
        `Check your .env.local against .env.example.`,
    );
  }
  return parsed.data;
}

let cachedServerEnv: ServerEnv | undefined;
let cachedClientEnv: ClientEnv | undefined;

/** Validated server-side environment. Do not import from client components. */
export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = validate(serverSchema, {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET,
      AI_PROVIDER_API_KEY: process.env.AI_PROVIDER_API_KEY,
    });
  }
  return cachedServerEnv;
}

/** Validated public environment. Safe to use in client components. */
export function getClientEnv(): ClientEnv {
  if (!cachedClientEnv) {
    cachedClientEnv = validate(clientSchema, {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    });
  }
  return cachedClientEnv;
}

/**
 * Exposed for tests and startup checks: validate everything at once.
 * Returns the validated values or throws on the first invalid schema.
 */
export function validateEnv(source: Record<string, string | undefined> = process.env) {
  return {
    server: validate(serverSchema, source),
    client: validate(clientSchema, source),
  };
}
