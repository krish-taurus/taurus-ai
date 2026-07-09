/**
 * Start the Slack install ("Add to Slack") flow (Sprint 038).
 *
 * GET /api/channels/slack/install?employeeId=…
 *
 * Requires an authenticated channel manager. Builds a signed `state` bound to the
 * user + org + employee, stores it in a short-lived httpOnly cookie (CSRF
 * double-submit), and redirects to Slack's OAuth consent screen.
 */

import { NextResponse } from "next/server";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import {
  buildInstallUrl,
  isSlackConfigured,
  resolveRedirectUri,
  signState,
  SLACK_STATE_COOKIE,
} from "@/modules/channels/slack/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { user, organization, membership } = await requireCurrentOrganization();
  const employeeId = new URL(request.url).searchParams.get("employeeId") ?? "";
  const back = employeeId
    ? `/dashboard/employees/${employeeId}/channels/slack`
    : "/dashboard/employees";

  if (!hasPermission(membership.role, "messaging_channel.manage")) {
    return NextResponse.redirect(new URL(`${back}?error=forbidden`, request.url));
  }
  if (!employeeId) {
    return NextResponse.redirect(new URL("/dashboard/employees", request.url));
  }
  if (!isSlackConfigured()) {
    return NextResponse.redirect(new URL(`${back}?error=unavailable`, request.url));
  }

  const state = signState({
    uid: user.id,
    orgId: organization.id,
    employeeId,
    nonce: globalThis.crypto.randomUUID(),
    iat: Date.now(),
  });
  const redirectUri = resolveRedirectUri(request.url);

  const res = NextResponse.redirect(buildInstallUrl({ state, redirectUri }));
  res.cookies.set(SLACK_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/channels/slack",
    maxAge: 600,
  });
  return res;
}
