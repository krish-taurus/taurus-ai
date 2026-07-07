import "server-only";

/**
 * Current user resolution (Prompt 002; Supabase Auth in Sprint 012) — server only.
 *
 * Resolves the authenticated Taurus user for the current request:
 *   - When Supabase Auth is configured, the user is derived from the verified
 *     Supabase session (supabase.auth.getUser(), which validates the JWT), then
 *     mapped to a Taurus user (created/linked on first sign-in).
 *   - Otherwise it falls back to the signed dev-session cookie (dev/test only).
 *
 * The user id is never trusted from the client — it always comes from a verified
 * server-side session. Returns null when there is no valid session.
 */

import { cookies } from "next/headers";
import { getStore } from "@/lib/db/store";
import type { User } from "@/lib/db/types";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/security/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  resolveTaurusUserForSupabaseIdentity,
  toSupabaseIdentity,
} from "@/modules/auth/supabase-user";

export async function getCurrentUser(): Promise<User | null> {
  if (isSupabaseConfigured()) {
    const supabaseUser = await getSupabaseTaurusUser();
    if (supabaseUser) return supabaseUser;
    // Fall through to the dev-session cookie so an explicitly-allowed dev auth
    // flow still works alongside Supabase.
  }

  const token = cookies().get(SESSION_COOKIE)?.value;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  return getStore().getUserById(payload.uid);
}

/**
 * Resolve the Taurus user from the verified Supabase session, mapping (and
 * creating/linking on first sign-in) as needed. Returns null when unauthenticated.
 */
async function getSupabaseTaurusUser(): Promise<User | null> {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const identity = toSupabaseIdentity(user);
    if (!identity) return null;

    return resolveTaurusUserForSupabaseIdentity(getStore(), identity);
  } catch {
    // Never let an auth-provider hiccup crash a protected page render; treat it
    // as unauthenticated so the caller redirects to sign-in.
    return null;
  }
}
