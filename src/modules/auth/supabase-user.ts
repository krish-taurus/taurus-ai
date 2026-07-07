/**
 * Supabase identity → Taurus user mapping (Sprint 012).
 *
 * Ensures every authenticated Supabase user has exactly one corresponding Taurus
 * application user, without disturbing the existing organization / membership /
 * role model. Supabase `auth.users.id` is stored on the Taurus user; memberships
 * continue to reference the internal Taurus `users.id`.
 *
 * Resolution order (idempotent):
 *   1. Match by Supabase auth id → return the linked Taurus user.
 *   2. Match by email → link that existing Taurus user to the Supabase identity
 *      (covers users created via the earlier dev-auth flow signing in via
 *      Supabase for the first time).
 *   3. Otherwise create a fresh Taurus user linked to the Supabase identity.
 *
 * Pure and store-driven so it is fully unit-testable with the in-memory store —
 * no network and no Supabase SDK dependency here.
 */

import type { DataStore } from "@/lib/db/store";
import type { User } from "@/lib/db/types";

export interface SupabaseIdentity {
  /** Supabase auth.users.id — never trust a client-provided value; derive it
   * from a verified server-side session (supabase.auth.getUser()). */
  supabaseAuthUserId: string;
  email: string;
  fullName?: string | null;
  avatarUrl?: string | null;
}

/**
 * Find or create the Taurus user for a verified Supabase identity, linking by
 * email when an unlinked account with the same email already exists.
 */
export async function resolveTaurusUserForSupabaseIdentity(
  store: DataStore,
  identity: SupabaseIdentity,
): Promise<User> {
  const email = identity.email.trim().toLowerCase();
  if (!email) {
    throw new Error("A verified email is required to resolve a Taurus user.");
  }

  const byAuthId = await store.getUserBySupabaseAuthId(identity.supabaseAuthUserId);
  if (byAuthId) return byAuthId;

  const byEmail = await store.getUserByEmail(email);
  if (byEmail) {
    if (byEmail.supabaseAuthUserId === identity.supabaseAuthUserId) return byEmail;
    if (byEmail.supabaseAuthUserId) {
      // The email is already linked to a different Supabase identity. Do not
      // silently re-point it; return the existing mapping unchanged.
      return byEmail;
    }
    return store.linkUserToSupabaseAuth(byEmail.id, identity.supabaseAuthUserId);
  }

  return store.createUser({
    email,
    fullName: identity.fullName ?? null,
    avatarUrl: identity.avatarUrl ?? null,
    supabaseAuthUserId: identity.supabaseAuthUserId,
  });
}

/**
 * Extract a normalized Taurus identity from a Supabase auth user object.
 * Supabase stores profile fields (name, avatar) under user_metadata, with
 * provider-specific key variations.
 */
export function toSupabaseIdentity(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): SupabaseIdentity | null {
  if (!user.email) return null;
  const meta = user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;
  const avatarUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;
  return {
    supabaseAuthUserId: user.id,
    email: user.email,
    fullName,
    avatarUrl,
  };
}
