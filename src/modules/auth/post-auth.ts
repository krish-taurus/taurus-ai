import "server-only";

/**
 * Post-authentication routing (Sprint 012) — server only.
 *
 * After a successful sign-in, decide where to send the user:
 *   - a safe internal `next` path when provided, else
 *   - the dashboard if they already belong to an organization, else
 *   - onboarding to create their first organization.
 *
 * This mirrors the guard behavior in requireCurrentOrganization() so the entry
 * experience is consistent no matter which auth method was used.
 */

import { getStore, type DataStore } from "@/lib/db/store";

/** Only allow same-origin, non-auth relative paths as a post-login `next`. */
export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  // Must be a relative path (no protocol/host) and not an auth or callback page.
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  const blocked = ["/login", "/signin", "/signup", "/auth", "/forgot-password", "/reset-password"];
  if (blocked.some((prefix) => next === prefix || next.startsWith(`${prefix}/`))) return null;
  return next;
}

/** Resolve the landing path for a freshly authenticated Taurus user id. */
export async function resolvePostAuthPath(
  taurusUserId: string,
  next?: string | null,
  store: DataStore = getStore(),
): Promise<string> {
  const safeNext = sanitizeNextPath(next);
  if (safeNext) return safeNext;

  const organizations = await store.listOrganizationsForUser(taurusUserId);
  return organizations.length > 0 ? "/dashboard" : "/onboarding";
}
