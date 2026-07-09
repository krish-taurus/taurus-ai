/**
 * Complete the SharePoint / OneDrive OAuth flow (Sprint 027).
 *
 * GET /api/knowledge/connectors/sharepoint/callback?code=…&state=…
 *
 * Verifies the signed `state` against the CSRF cookie and the current user/org,
 * exchanges the code for tokens, then stashes the (encrypted) refresh token in a
 * short-lived httpOnly cookie and redirects back to the Add Knowledge form, where
 * the manager pastes a sharing link. The refresh token never reaches the browser.
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
} from "@/modules/knowledge/connectors/sharepoint";

export const dynamic = "force-dynamic";

function backToForm(request: Request, params: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/dashboard/knowledge/new?connect=sharepoint&${params}`, request.url),
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
    res.cookies.set(OAUTH_STATE_COOKIE, "", {
      path: "/api/knowledge/connectors/sharepoint",
      maxAge: 0,
    });
    return res;
  } catch {
    return backToForm(request, "error=exchange");
  }
}
