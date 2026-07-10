/**
 * Production readiness check (Sprint 044).
 *
 * The app never crashes on missing configuration — it silently downgrades to a
 * simulated/local/in-memory mode. That's convenient in dev and dangerous in prod
 * (a deploy "boots fine" while losing data and serving no real AI). This module
 * inspects the environment and reports blockers (will break or lose data in
 * production) and warnings (a feature is silently disabled). It is pure and
 * injectable, so the CLI (`npm run check:prod`) and `/api/health` share it.
 */

export type ReadinessSeverity = "blocker" | "warning";

export interface ReadinessIssue {
  code: string;
  severity: ReadinessSeverity;
  title: string;
  detail: string;
}

export interface ReadinessReport {
  /** True when there are no blockers (production may still have warnings). */
  ok: boolean;
  /** Whether production rules were evaluated. */
  production: boolean;
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
}

/** Platform provider keys — any one enables managed AI serving. */
const MODEL_PROVIDER_KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "DEEPSEEK_API_KEY",
  "MOONSHOT_API_KEY",
  "GROQ_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "FIREWORKS_API_KEY",
];

type Env = Record<string, string | undefined>;

/**
 * Evaluate production readiness. In non-production this returns an all-clear
 * unless `force` is set (the CLI forces production rules so you can check a
 * deploy's env from anywhere).
 */
export function checkProductionReadiness(
  env: Env = process.env,
  opts: { force?: boolean } = {},
): ReadinessReport {
  const production = opts.force === true || env.NODE_ENV === "production";
  const blockers: ReadinessIssue[] = [];
  const warnings: ReadinessIssue[] = [];
  if (!production) return { ok: true, production, blockers, warnings };

  const has = (k: string): boolean => Boolean(env[k] && env[k]!.trim());

  // --- Database: unset => in-memory => data loss ---------------------------
  if (!has("DATABASE_URL")) {
    blockers.push({
      code: "database_missing",
      severity: "blocker",
      title: "No DATABASE_URL — running on the in-memory store",
      detail:
        "All data lives in process memory and is lost on every restart/redeploy. Set DATABASE_URL to a persistent Postgres (with pgvector) and run `npm run db:migrate`.",
    });
  }

  // --- Session secret ------------------------------------------------------
  const secret = env.AUTH_SECRET ?? "";
  if (secret.trim().length < 16) {
    blockers.push({
      code: "auth_secret_weak",
      severity: "blocker",
      title: "AUTH_SECRET is missing or too short",
      detail: "Set AUTH_SECRET to a strong value of at least 16 characters; it signs sessions + OAuth state.",
    });
  }

  // --- Auth provider -------------------------------------------------------
  const supabase = has("NEXT_PUBLIC_SUPABASE_URL") && has("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const devAuth = env.TAURUS_ALLOW_DEV_AUTH === "true";
  if (!supabase && !devAuth) {
    blockers.push({
      code: "auth_unconfigured",
      severity: "blocker",
      title: "No production auth provider configured",
      detail:
        "Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (and a custom SMTP in Supabase for auth emails).",
    });
  }
  if (devAuth) {
    blockers.push({
      code: "dev_auth_enabled",
      severity: "blocker",
      title: "TAURUS_ALLOW_DEV_AUTH is enabled in production",
      detail:
        "This allows anyone to sign in with only an email — no password. Unset it and use Supabase for production auth.",
    });
  }

  // --- Model provider: prod disables the demo brain ------------------------
  const anyModelKey = MODEL_PROVIDER_KEYS.some(has);
  const byokMaster = has("TAURUS_MODEL_CREDENTIALS_MASTER_KEY");
  if (!anyModelKey && !byokMaster) {
    blockers.push({
      code: "no_model_provider",
      severity: "blocker",
      title: "No AI model provider configured",
      detail:
        "The demo brain is disabled in production, so every AI interaction throws provider_not_configured. Set at least one provider key (e.g. OPENAI_API_KEY).",
    });
  } else if (!anyModelKey && byokMaster) {
    warnings.push({
      code: "byok_only_models",
      severity: "warning",
      title: "No platform model key — AI relies entirely on customer BYOK",
      detail:
        "Only organizations that add their own model key will get AI. Set a platform key (e.g. OPENAI_API_KEY) for managed serving.",
    });
  }

  // --- Embeddings model: real vs local semantic-lite ----------------------
  // Knowledge retrieval embeds with OpenAI (text-embedding-3-small) when a key
  // is available; without one it falls back to the deterministic local
  // bag-of-words embedder (works, but weaker semantic recall). Only OPENAI_API_KEY
  // powers the platform embedder — other provider keys don't. (Orgs with their
  // own OpenAI BYOK key still get the real model regardless of this warning.)
  if (!has("OPENAI_API_KEY")) {
    warnings.push({
      code: "embeddings_local_only",
      severity: "warning",
      title: "No OPENAI_API_KEY — knowledge retrieval uses the local semantic-lite embedder",
      detail:
        "Chat retrieval still works but with weaker semantic recall. Set OPENAI_API_KEY for real embeddings (text-embedding-3-small), then re-prepare knowledge or run the backfill to re-embed existing sources.",
    });
  }

  // --- Public app URL ------------------------------------------------------
  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "";
  if (!appUrl.trim() || appUrl.includes("localhost")) {
    warnings.push({
      code: "app_url_default",
      severity: "warning",
      title: "NEXT_PUBLIC_APP_URL is unset or localhost",
      detail: "Every webhook, OAuth redirect and reach link is built from this. Set it to your public origin.",
    });
  }

  // --- Uploads: local disk only (warn unless a volume path is set) ---------
  if (!has("TAURUS_UPLOAD_DIR")) {
    warnings.push({
      code: "uploads_local_disk",
      severity: "warning",
      title: "Uploaded files fall back to ./storage/uploads",
      detail:
        "Knowledge-vault uploads write to local disk. Set TAURUS_UPLOAD_DIR to a persistent volume — on serverless the default path is ephemeral and files are lost. (No object-storage adapter exists yet.)",
    });
  }

  // --- Channel encryption master key --------------------------------------
  if (!has("TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY")) {
    warnings.push({
      code: "channel_master_key_missing",
      severity: "warning",
      title: "TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY is not set",
      detail:
        "Slack/WhatsApp/Messenger/Instagram/Teams connect flows store tokens encrypted — without this key those tokens are dropped and the channel stays simulated.",
    });
  }

  // --- Payment webhook secrets --------------------------------------------
  if (has("STRIPE_SECRET_KEY") && !has("STRIPE_WEBHOOK_SECRET")) {
    warnings.push({
      code: "stripe_webhook_secret_missing",
      severity: "warning",
      title: "Stripe key set without STRIPE_WEBHOOK_SECRET",
      detail:
        "Webhook signatures can't be verified, so every Stripe event is rejected (400) — checkouts happen but status never syncs back.",
    });
  }
  const razorpayKeys = has("RAZORPAY_KEY_ID") || has("RAZORPAY_KEY_SECRET");
  if (razorpayKeys && !has("RAZORPAY_WEBHOOK_SECRET")) {
    warnings.push({
      code: "razorpay_webhook_secret_missing",
      severity: "warning",
      title: "Razorpay keys set without RAZORPAY_WEBHOOK_SECRET",
      detail: "Razorpay webhooks can't be verified, so payments never reconcile to fulfilled.",
    });
  }

  return { ok: blockers.length === 0, production, blockers, warnings };
}

/** A one-line status word for monitoring. */
export function readinessStatus(report: ReadinessReport): "ok" | "degraded" | "blocked" | "dev" {
  if (!report.production) return "dev";
  if (report.blockers.length > 0) return "blocked";
  if (report.warnings.length > 0) return "degraded";
  return "ok";
}

/** Human-readable multi-line report for the CLI / deploy logs. */
export function formatReadinessReport(report: ReadinessReport): string {
  const lines: string[] = [];
  const bullet = (i: ReadinessIssue) => `  - [${i.code}] ${i.title}\n      ${i.detail}`;
  if (!report.production) {
    lines.push("Not evaluating production rules (NODE_ENV is not 'production'; pass --force to check anyway).");
    return lines.join("\n");
  }
  if (report.blockers.length === 0 && report.warnings.length === 0) {
    lines.push("✓ Production readiness: no blockers, no warnings.");
    return lines.join("\n");
  }
  if (report.blockers.length > 0) {
    lines.push(`✗ ${report.blockers.length} blocker(s) — these will break or lose data in production:`);
    report.blockers.forEach((i) => lines.push(bullet(i)));
  }
  if (report.warnings.length > 0) {
    lines.push(`! ${report.warnings.length} warning(s) — a feature is silently disabled:`);
    report.warnings.forEach((i) => lines.push(bullet(i)));
  }
  return lines.join("\n");
}
