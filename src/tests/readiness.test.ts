import { describe, it, expect } from "vitest";
import {
  checkProductionReadiness,
  readinessStatus,
  formatReadinessReport,
} from "@/lib/env/readiness";

/** A fully-configured production env with no blockers and no warnings. */
function healthyEnv(): Record<string, string> {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgres://user:pw@host/db",
    AUTH_SECRET: "a-strong-secret-value-1234",
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    NEXT_PUBLIC_APP_URL: "https://app.taurus.ai",
    OPENAI_API_KEY: "sk-x",
    TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY: "x".repeat(24),
    TAURUS_UPLOAD_DIR: "/data/uploads",
  };
}

describe("checkProductionReadiness", () => {
  it("passes with no blockers or warnings when fully configured", () => {
    const report = checkProductionReadiness(healthyEnv());
    expect(report.production).toBe(true);
    expect(report.ok).toBe(true);
    expect(report.blockers).toHaveLength(0);
    expect(report.warnings).toHaveLength(0);
    expect(readinessStatus(report)).toBe("ok");
  });

  it("treats non-production as all-clear (dev)", () => {
    const report = checkProductionReadiness({ NODE_ENV: "development" });
    expect(report.production).toBe(false);
    expect(report.ok).toBe(true);
    expect(readinessStatus(report)).toBe("dev");
  });

  it("--force evaluates production rules regardless of NODE_ENV", () => {
    const report = checkProductionReadiness({ NODE_ENV: "development" }, { force: true });
    expect(report.production).toBe(true);
    expect(report.blockers.length).toBeGreaterThan(0);
  });

  it("flags the core blockers on an empty production env", () => {
    const report = checkProductionReadiness({ NODE_ENV: "production" });
    const codes = report.blockers.map((b) => b.code);
    expect(codes).toContain("database_missing");
    expect(codes).toContain("auth_secret_weak");
    expect(codes).toContain("auth_unconfigured");
    expect(codes).toContain("no_model_provider");
    expect(report.ok).toBe(false);
    expect(readinessStatus(report)).toBe("blocked");
  });

  it("blocks when dev auth is enabled in production", () => {
    const report = checkProductionReadiness({ ...healthyEnv(), TAURUS_ALLOW_DEV_AUTH: "true" });
    expect(report.blockers.map((b) => b.code)).toContain("dev_auth_enabled");
  });

  it("downgrades to a warning when only customer BYOK models are available", () => {
    const env = { ...healthyEnv() };
    delete env.OPENAI_API_KEY;
    env.TAURUS_MODEL_CREDENTIALS_MASTER_KEY = "y".repeat(24);
    const report = checkProductionReadiness(env);
    expect(report.blockers.map((b) => b.code)).not.toContain("no_model_provider");
    expect(report.warnings.map((w) => w.code)).toContain("byok_only_models");
  });

  it("warns about missing webhook secrets + local uploads + missing channel key", () => {
    const env: Record<string, string> = {
      ...healthyEnv(),
      STRIPE_SECRET_KEY: "sk_live",
      RAZORPAY_KEY_ID: "rzp",
    };
    delete env.TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY;
    delete env.TAURUS_UPLOAD_DIR;
    const codes = checkProductionReadiness(env).warnings.map((w) => w.code);
    expect(codes).toContain("uploads_local_disk");
    expect(codes).toContain("channel_master_key_missing");
    expect(codes).toContain("stripe_webhook_secret_missing");
    expect(codes).toContain("razorpay_webhook_secret_missing");
  });

  it("warns that embeddings fall back to local when OPENAI_API_KEY is unset", () => {
    const env = { ...healthyEnv() };
    delete env.OPENAI_API_KEY;
    env.ANTHROPIC_API_KEY = "sk-ant"; // a model provider, but not the embeddings one
    const codes = checkProductionReadiness(env).warnings.map((w) => w.code);
    expect(codes).toContain("embeddings_local_only");
  });

  it("does not warn about embeddings when OPENAI_API_KEY is set", () => {
    const codes = checkProductionReadiness(healthyEnv()).warnings.map((w) => w.code);
    expect(codes).not.toContain("embeddings_local_only");
  });

  it("warns when the app URL is unset or localhost", () => {
    const env = { ...healthyEnv(), NEXT_PUBLIC_APP_URL: "http://localhost:3000" };
    expect(checkProductionReadiness(env).warnings.map((w) => w.code)).toContain("app_url_default");
    expect(readinessStatus(checkProductionReadiness(env))).toBe("degraded");
  });

  it("formats a readable report", () => {
    const text = formatReadinessReport(checkProductionReadiness({ NODE_ENV: "production" }));
    expect(text).toContain("blocker(s)");
    expect(text).toContain("database_missing");
  });
});
