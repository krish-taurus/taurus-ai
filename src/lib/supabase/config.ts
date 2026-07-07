/**
 * Supabase configuration helpers (Sprint 012).
 *
 * Small, dependency-free predicates used across server, client, and middleware
 * to decide whether production Supabase Auth is active and whether the
 * passwordless development auth flow may be offered.
 *
 * Only the public (NEXT_PUBLIC_*) URL and anon key are read here — never the
 * service role key. The anon key is designed to be exposed to the browser.
 */

/** Public Supabase project URL, or null when not configured. */
export function getSupabaseUrl(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || null;
}

/** Public Supabase anon key, or null when not configured. */
export function getSupabaseAnonKey(): string | null {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || null;
}

/** True when both the Supabase URL and anon key are present. */
export function isSupabaseConfigured(): boolean {
  return !!getSupabaseUrl() && !!getSupabaseAnonKey();
}

/**
 * Whether the passwordless development auth flow may be used/shown.
 *
 * Available outside production always; in production only when explicitly
 * enabled via TAURUS_ALLOW_DEV_AUTH=true. This keeps the insecure dev flow out
 * of production by default (matching src/modules/auth/provider.ts).
 */
export function isDevAuthAvailable(): boolean {
  const isProduction = process.env.NODE_ENV === "production";
  const allowed = process.env.TAURUS_ALLOW_DEV_AUTH === "true";
  return !isProduction || allowed;
}
