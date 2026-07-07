"use client";

/**
 * Supabase browser client (Sprint 012).
 *
 * Used by client components to run the auth flows Supabase performs in the
 * browser: OAuth (Google, LinkedIn), email + password, and email OTP / magic
 * link. The @supabase/ssr browser client persists the session in cookies so the
 * Next.js server can read it on the next request.
 *
 * Only the public URL + anon key are used here; both are safe for the browser.
 * Throws a clear error if called when Supabase is not configured.
 */

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY to enable authentication.",
    );
  }
  return createBrowserClient(url, anonKey);
}
