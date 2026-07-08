/**
 * Complete the Google Drive OAuth flow (Sprint 023).
 *
 * GET /api/knowledge/connectors/google-drive/callback?code=…&state=…
 *
 * Verifies the signed `state` against the CSRF cookie and the current user/org,
 * exchanges the code for tokens, then stashes the (encrypted) refresh token in a
 * short-lived httpOnly cookie and redirects back to the Add Knowledge form, where
 * the manager picks which file/folder to import. The refresh token is never
 * exposed to the browser.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { isEncryptionConfigured } from "@/modules/model-gateway/credentials";
import {
  encodePendingConnection,
  exchangeCodeForTokens,
  fetchAccountEmail,
  resolveRedirectUri,
  verifyState,
  OAUTH_STATE_COOKIE,
  PENDING_COOKIE,
} from "@/modules/knowledge/connectors/google-drive";

export const dynamic = "force-dynamic";

function backToForm(request: Request, params: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/dashboard/knowledge/new?connect=google-drive&${params}`, request.url),
  );
}

export async function GET(request: Request) {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "knowledge.manage")) {
    return NextResponse.redirect(new URL("/dashboard/knowledge", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  if (url.searchParams.get("error") || !code) {
    return backToForm(request, "error=denied");
  }

  // Verify the state signature AND that it matches the cookie we set (CSRF), and
  // that it is still bound to this same user + organization.
  const cookieState = cookies().get(OAUTH_STATE_COOKIE)?.value;
  const payload = await verifyState(stateParam);
  if (
    !payload ||
    !cookieState ||
    cookieState !== stateParam ||
    payload.uid !== user.id ||
    payload.orgId !== organization.id
  ) {
    return backToForm(request, "error=state");
  }

  if (!isEncryptionConfigured()) {
    return backToForm(request, "error=unavailable");
  }

  try {
    const redirectUri = resolveRedirectUri(request.url);
    const tokens = await exchangeCodeForTokens({ code, redirectUri });
    if (!tokens.refreshToken) {
      // No refresh token (e.g. previously consented without offline access).
      return backToForm(request, "error=norefresh");
    }
    const email = await fetchAccountEmail(tokens.accessToken);
    const pending = await encodePendingConnection({ refreshToken: tokens.refreshToken, email });

    const res = backToForm(request, "connected=1");
    res.cookies.set(PENDING_COOKIE, pending, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 900,
    });
    // Expire the state cookie at the path it was set on.
    res.cookies.set(OAUTH_STATE_COOKIE, "", {
      path: "/api/knowledge/connectors/google-drive",
      maxAge: 0,
    });
    return res;
  } catch {
    return backToForm(request, "error=exchange");
  }
}
