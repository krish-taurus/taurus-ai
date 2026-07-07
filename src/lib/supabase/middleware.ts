/**
 * Supabase middleware session helper (Sprint 012).
 *
 * Refreshes the Supabase auth session on every request and mirrors the updated
 * auth cookies onto the response, following the @supabase/ssr Next.js pattern.
 * Returns both the (possibly cookie-updated) response and the authenticated
 * Supabase user id so the middleware can gate protected routes.
 *
 * Runs on the Edge runtime. Only the public URL + anon key are used.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

export interface SupabaseSessionResult {
  response: NextResponse;
  userId: string | null;
}

export async function updateSupabaseSession(request: NextRequest): Promise<SupabaseSessionResult> {
  let response = NextResponse.next({ request });

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) {
    return { response, userId: null };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() validates the token with Supabase and refreshes it if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, userId: user?.id ?? null };
}
