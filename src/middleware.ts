/**
 * Route protection middleware (Prompt 002).
 *
 * First gate for protected areas: verifies the signed session cookie on the
 * edge before a request reaches the dashboard. The server components then
 * re-check with requireUser()/requireCurrentOrganization() (defense in depth,
 * and to load the actual user + organization).
 *
 * - Unauthenticated requests to /dashboard/* or /onboarding → /login.
 * - Authenticated requests to /login or /signup → /dashboard.
 */

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/security/session";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding"];
const AUTH_PAGES = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on app routes only; skip static assets and API internals.
  matcher: ["/dashboard/:path*", "/onboarding", "/login", "/signup"],
};
