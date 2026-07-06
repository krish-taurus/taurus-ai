/**
 * Authentication provider abstraction (Prompt 002).
 *
 * Taurus authenticates through a provider so the credential mechanism can be
 * swapped (Supabase / Clerk / SSO) without touching the rest of the app. The
 * `users` table is an application-level mirror keyed by email; the provider owns
 * the actual identity check.
 *
 * The default `DevCredentialsProvider` is a passwordless, email-only stand-in
 * for local development. It intentionally REFUSES to run in production unless
 * TAURUS_ALLOW_DEV_AUTH=true is explicitly set, so an insecure dev flow can
 * never ship to production by accident (least privilege / safe default).
 */

import { z } from "zod";
import type { DataStore } from "@/lib/db/store";
import type { User } from "@/lib/db/types";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");
export const fullNameSchema = z.string().trim().min(1).max(120).optional();

export interface AuthProvider {
  readonly name: string;
  /** Find or verify an existing user for sign-in. Returns null if not found. */
  signIn(store: DataStore, email: string): Promise<User | null>;
  /** Create a new user for sign-up. Throws if the email already exists. */
  signUp(store: DataStore, email: string, fullName?: string): Promise<User>;
}

function assertDevAuthAllowed(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const allowed = process.env.TAURUS_ALLOW_DEV_AUTH === "true";
  if (isProduction && !allowed) {
    throw new Error(
      "Development authentication is disabled in production. Configure a real auth " +
        "provider, or set TAURUS_ALLOW_DEV_AUTH=true to explicitly allow the dev flow.",
    );
  }
}

/**
 * Passwordless, email-only development provider. Verifies identity by matching a
 * known email (sign-in) or creating one (sign-up). Not for production.
 */
export class DevCredentialsProvider implements AuthProvider {
  readonly name = "dev-credentials";

  async signIn(store: DataStore, email: string): Promise<User | null> {
    assertDevAuthAllowed();
    const normalized = emailSchema.parse(email);
    return store.getUserByEmail(normalized);
  }

  async signUp(store: DataStore, email: string, fullName?: string): Promise<User> {
    assertDevAuthAllowed();
    const normalized = emailSchema.parse(email);
    const existing = await store.getUserByEmail(normalized);
    if (existing) {
      throw new Error("An account with this email already exists. Try signing in instead.");
    }
    return store.createUser({ email: normalized, fullName: fullName ?? null });
  }
}

let cachedProvider: AuthProvider | undefined;

/**
 * Returns the configured auth provider. Only the dev provider exists in the
 * foundation; a Supabase/Clerk provider plugs in here in a later prompt.
 */
export function getAuthProvider(): AuthProvider {
  if (!cachedProvider) {
    cachedProvider = new DevCredentialsProvider();
  }
  return cachedProvider;
}
