/**
 * Route protection middleware (Prompt 002; Supabase Auth in Sprint 012).
 *
 * First gate for protected areas. When Supabase Auth is configured it refreshes
 * the Supabase session (rotating cookies) and uses it to determine whether the
 * request is authenticated; otherwise it falls back to verifying the signed
 * dev-session cookie. Server components then re-check with requireUser() /
 * requireCurrentOrganization() (defense in depth, and to load the actual
 * user + organization).
 *
 * - Unauthenticated requests to /dashboard/* or /onboarding → /login.
 * - Authenticated requests to /login, /signin, or /signup → /dashboard.
 */

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/security/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateSupabaseSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding"];
const AUTH_PAGES = ["/login", "/signin", "/signup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Resolve authentication + carry forward any refreshed Supabase cookies.
  let response = NextResponse.next({ request });
  let isAuthenticated: boolean;

  if (isSupabaseConfigured()) {
    const result = await updateSupabaseSession(request);
    response = result.response;
    isAuthenticated = result.userId !== null;
  } else {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    isAuthenticated = (await verifySessionToken(token)) !== null;
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  // Run on app routes only; skip static assets and API internals.
  matcher: ["/dashboard/:path*", "/onboarding", "/login", "/signin", "/signup"],
};
