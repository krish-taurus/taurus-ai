/**
 * Start the SharePoint / OneDrive OAuth flow (Sprint 027).
 *
 * GET /api/knowledge/connectors/sharepoint/start
 *
 * Requires an authenticated manager. Builds a signed `state` bound to the user +
 * organization, stores it in a short-lived httpOnly cookie (CSRF double-submit),
 * and redirects to Microsoft's consent screen for read-only Files/Sites access.
 */

import { NextResponse } from "next/server";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import {
  buildConsentUrl,
  isSharePointConfigured,
  resolveRedirectUri,
  signState,
  OAUTH_STATE_COOKIE,
} from "@/modules/knowledge/connectors/sharepoint";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "knowledge.manage")) {
    return NextResponse.redirect(new URL("/dashboard/knowledge", request.url));
  }
  if (!isSharePointConfigured()) {
    return NextResponse.redirect(
      new URL("/dashboard/knowledge/new?connect=sharepoint&error=unavailable", request.url),
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
    path: "/api/knowledge/connectors/sharepoint",
    maxAge: 600,
  });
  return res;
}
