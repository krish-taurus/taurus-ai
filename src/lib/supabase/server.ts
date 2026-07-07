import "server-only";

/**
 * Supabase server client (Sprint 012) — server only.
 *
 * Reads/writes the Supabase session cookies via Next.js `cookies()` so server
 * components, server actions, and route handlers can resolve the authenticated
 * user with `supabase.auth.getUser()` (which verifies the JWT with Supabase,
 * unlike getSession which trusts the cookie).
 *
 * In a read-only Server Component context, cookie writes are not allowed; those
 * attempts are swallowed because the middleware is responsible for refreshing
 * the session cookies on each request.
 */

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

export function createSupabaseServerClient() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY to enable authentication.",
    );
  }

  const cookieStore = cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where cookies are read-only. Safe to
          // ignore: the middleware refreshes the session cookies each request.
        }
      },
    },
  });
}
