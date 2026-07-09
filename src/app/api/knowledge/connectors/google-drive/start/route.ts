/**
 * Start the Google Drive OAuth flow (Sprint 023).
 *
 * GET /api/knowledge/connectors/google-drive/start
 *
 * Requires an authenticated manager. Builds a signed `state` bound to the user +
 * organization, stores it in a short-lived httpOnly cookie (CSRF double-submit),
 * and redirects the browser to Google's consent screen for the read-only Drive
 * scope. The callback route completes the exchange.
 */

import { NextResponse } from "next/server";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import {
  buildConsentUrl,
  isGoogleDriveConfigured,
  resolveRedirectUri,
  signState,
  OAUTH_STATE_COOKIE,
} from "@/modules/knowledge/connectors/google-drive";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "knowledge.manage")) {
    return NextResponse.redirect(new URL("/dashboard/knowledge", request.url));
  }
  if (!isGoogleDriveConfigured()) {
    return NextResponse.redirect(
      new URL("/dashboard/knowledge/new?connect=google-drive&error=unavailable", request.url),
    );
  }

  const state = await signState({
    uid: user.id,
    orgId: organization.id,
    nonce: globalThis.crypto.randomUUID(),
    iat: Date.now(),
  });

  const redirectUri = resolveRedirectUri(request.url);
  const consentUrl = buildConsentUrl({ state, redirectUri });

  const res = NextResponse.redirect(consentUrl);
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/knowledge/connectors/google-drive",
    maxAge: 600,
  });
  return res;
}
