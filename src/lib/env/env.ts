import { z } from "zod";

/**
 * Environment validation for Taurus AI.
 *
 * All environment access should go through this module so that missing or
 * malformed configuration fails fast with a clear message instead of causing
 * confusing runtime errors deep in the app.
 *
 * DATABASE_URL is optional: when unset, the app uses an in-memory data store for
 * local dev/tests; when set, it uses PostgreSQL. AUTH_SECRET is required for
 * sessions and must be strong; it is mandatory in production.
 *
 * SECURITY: Only variables prefixed with `NEXT_PUBLIC_` are exposed to the
 * browser. Server secrets (AI_PROVIDER_API_KEY, AUTH_SECRET, DATABASE_URL) are
 * validated here but must never be imported into client components.
 */

const MIN_SECRET_LENGTH = 16;

const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url().optional().or(z.literal("")),
    // Session signing secret. Optional in dev/test, required in production, and
    // must be at least MIN_SECRET_LENGTH characters whenever it is provided.
    AUTH_SECRET: z.string().optional().or(z.literal("")),
    // Explicit opt-in required to use the passwordless dev auth in production.
    TAURUS_ALLOW_DEV_AUTH: z.enum(["true", "false"]).optional().or(z.literal("")),
    // Supabase Auth (Sprint 012). Production authentication provider. The URL and
    // anon key are public (NEXT_PUBLIC_*) and safe for the browser. All optional
    // so local dev / tests can fall back to the passwordless dev auth flow; in
    // production Supabase must be configured unless dev auth is explicitly allowed.
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
    // Service role key — SERVER ONLY, never exposed to the browser. Optional and
    // not required for the auth flows in this sprint; present only for future
    // privileged server tasks. It must never be imported into client code.
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
    // Local directory for Knowledge Vault uploads (server-only). Defaults to
    // "storage/uploads" (gitignored). Files are never served publicly.
    TAURUS_UPLOAD_DIR: z.string().optional().or(z.literal("")),
    AI_PROVIDER_API_KEY: z.string().optional().or(z.literal("")),
    // Model Hub (Prompt 006B). All provider keys are optional and server-only;
    // when present, the matching provider can be offered as "Taurus managed".
    // Their absence must never break local dev or tests.
    OPENAI_API_KEY: z.string().optional().or(z.literal("")),
    ANTHROPIC_API_KEY: z.string().optional().or(z.literal("")),
    DEEPSEEK_API_KEY: z.string().optional().or(z.literal("")),
    MOONSHOT_API_KEY: z.string().optional().or(z.literal("")),
    GROQ_API_KEY: z.string().optional().or(z.literal("")),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional().or(z.literal("")),
    FIREWORKS_API_KEY: z.string().optional().or(z.literal("")),
    // Master key for encrypting bring-your-own-key provider credentials at rest.
    // If unset, BYOK is disabled in the UI (Taurus-managed keys still work).
    TAURUS_MODEL_CREDENTIALS_MASTER_KEY: z.string().optional().or(z.literal("")),
    // Messaging Channels (Prompt 009). All optional and server-only. Their
    // absence must never break local dev or tests — messaging falls back to a
    // simulated provider. Master key gates bring-your-own-key credential storage.
    TWILIO_ACCOUNT_SID: z.string().optional().or(z.literal("")),
    TWILIO_AUTH_TOKEN: z.string().optional().or(z.literal("")),
    TWILIO_MESSAGING_SERVICE_SID: z.string().optional().or(z.literal("")),
    META_WHATSAPP_ACCESS_TOKEN: z.string().optional().or(z.literal("")),
    META_WHATSAPP_PHONE_NUMBER_ID: z.string().optional().or(z.literal("")),
    META_WHATSAPP_VERIFY_TOKEN: z.string().optional().or(z.literal("")),
    SENDGRID_API_KEY: z.string().optional().or(z.literal("")),
    MAILGUN_API_KEY: z.string().optional().or(z.literal("")),
    MAILGUN_DOMAIN: z.string().optional().or(z.literal("")),
    // Telegram bot channel (Sprint 036). Optional + server-only; absent → the
    // Telegram channel runs in simulated mode. TELEGRAM_WEBHOOK_SECRET is the
    // optional secret token echoed in X-Telegram-Bot-Api-Secret-Token.
    TELEGRAM_BOT_TOKEN: z.string().optional().or(z.literal("")),
    TELEGRAM_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),
    TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY: z.string().optional().or(z.literal("")),
    // Voice Call Channel (Prompt 010). All optional and server-only; their absence
    // never breaks local dev or tests — voice falls back to simulated providers.
    TELNYX_API_KEY: z.string().optional().or(z.literal("")),
    TELNYX_PUBLIC_KEY: z.string().optional().or(z.literal("")),
    VONAGE_API_KEY: z.string().optional().or(z.literal("")),
    VONAGE_API_SECRET: z.string().optional().or(z.literal("")),
    DEEPGRAM_API_KEY: z.string().optional().or(z.literal("")),
    ELEVENLABS_API_KEY: z.string().optional().or(z.literal("")),
    // Billing, Plans & Subscriptions (Sprint 015). All optional and SERVER-ONLY
    // (never NEXT_PUBLIC_*). When STRIPE_SECRET_KEY is absent, billing runs in
    // simulated mode — local dev and tests never touch the network or charge.
    STRIPE_SECRET_KEY: z.string().optional().or(z.literal("")),
    STRIPE_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),
    STRIPE_PRICE_GROWTH: z.string().optional().or(z.literal("")),
    STRIPE_PRICE_SCALE: z.string().optional().or(z.literal("")),
    // Marketplace paid lease / revenue-share (Sprint 034). All optional and
    // SERVER-ONLY. When neither Stripe nor Razorpay is configured, marketplace
    // purchases run in simulated mode — dev and tests never charge.
    RAZORPAY_KEY_ID: z.string().optional().or(z.literal("")),
    RAZORPAY_KEY_SECRET: z.string().optional().or(z.literal("")),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional().or(z.literal("")),
    // Platform revenue-share cut in basis points (default 1500 = 15%).
    MARKETPLACE_PLATFORM_FEE_BPS: z.string().optional().or(z.literal("")),
    // Usage & Margin (Sprint 016). Comma-separated allowlist of platform-OPERATOR
    // user ids that may see Taurus's cross-tenant cost/margin. SERVER-ONLY (never
    // NEXT_PUBLIC_*); this is NOT an org role and is never assignable from the
    // tenant UI. Absent → nobody is an operator (deny-by-default).
    PLATFORM_OPERATOR_USER_IDS: z.string().optional().or(z.literal("")),
    // Optional operator-tunable managed sell prices (Sprint 016; displayed only).
    MANAGED_INTERACTION_PRICE_USD: z.string().optional().or(z.literal("")),
    MANAGED_INTERACTION_PRICE_BUDGET_USD: z.string().optional().or(z.literal("")),
  })
  .superRefine((env, ctx) => {
    const secret = env.AUTH_SECRET;
    if (secret && secret.length < MIN_SECRET_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_SECRET"],
        message: `AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`,
      });
    }
    if (env.NODE_ENV === "production" && (!secret || secret.length < MIN_SECRET_LENGTH)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_SECRET"],
        message: "AUTH_SECRET is required in production and must be a strong secret.",
      });
    }
    // Production must use a real auth provider by default. Supabase Auth is
    // required in production unless dev auth is explicitly opted into.
    const supabaseConfigured =
      !!env.NEXT_PUBLIC_SUPABASE_URL && !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const devAuthAllowed = env.TAURUS_ALLOW_DEV_AUTH === "true";
    if (env.NODE_ENV === "production" && !supabaseConfigured && !devAuthAllowed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_SUPABASE_URL"],
        message:
          "Production authentication requires Supabase: set NEXT_PUBLIC_SUPABASE_URL and " +
          "NEXT_PUBLIC_SUPABASE_ANON_KEY (or set TAURUS_ALLOW_DEV_AUTH=true to override).",
      });
    }
  });

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  // Public Supabase config — safe to expose to the browser. Optional so the app
  // still builds/runs without Supabase configured (dev auth fallback).
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
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
      TAURUS_ALLOW_DEV_AUTH: process.env.TAURUS_ALLOW_DEV_AUTH,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      TAURUS_UPLOAD_DIR: process.env.TAURUS_UPLOAD_DIR,
      AI_PROVIDER_API_KEY: process.env.AI_PROVIDER_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
      MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY,
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      FIREWORKS_API_KEY: process.env.FIREWORKS_API_KEY,
      TAURUS_MODEL_CREDENTIALS_MASTER_KEY: process.env.TAURUS_MODEL_CREDENTIALS_MASTER_KEY,
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID,
      META_WHATSAPP_ACCESS_TOKEN: process.env.META_WHATSAPP_ACCESS_TOKEN,
      META_WHATSAPP_PHONE_NUMBER_ID: process.env.META_WHATSAPP_PHONE_NUMBER_ID,
      META_WHATSAPP_VERIFY_TOKEN: process.env.META_WHATSAPP_VERIFY_TOKEN,
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
      MAILGUN_API_KEY: process.env.MAILGUN_API_KEY,
      MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN,
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
      TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY: process.env.TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY,
      TELNYX_API_KEY: process.env.TELNYX_API_KEY,
      TELNYX_PUBLIC_KEY: process.env.TELNYX_PUBLIC_KEY,
      VONAGE_API_KEY: process.env.VONAGE_API_KEY,
      VONAGE_API_SECRET: process.env.VONAGE_API_SECRET,
      DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      STRIPE_PRICE_GROWTH: process.env.STRIPE_PRICE_GROWTH,
      STRIPE_PRICE_SCALE: process.env.STRIPE_PRICE_SCALE,
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
      MARKETPLACE_PLATFORM_FEE_BPS: process.env.MARKETPLACE_PLATFORM_FEE_BPS,
      PLATFORM_OPERATOR_USER_IDS: process.env.PLATFORM_OPERATOR_USER_IDS,
      MANAGED_INTERACTION_PRICE_USD: process.env.MANAGED_INTERACTION_PRICE_USD,
      MANAGED_INTERACTION_PRICE_BUDGET_USD: process.env.MANAGED_INTERACTION_PRICE_BUDGET_USD,
    });
  }
  return cachedServerEnv;
}

/** Validated public environment. Safe to use in client components. */
export function getClientEnv(): ClientEnv {
  if (!cachedClientEnv) {
    cachedClientEnv = validate(clientSchema, {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
