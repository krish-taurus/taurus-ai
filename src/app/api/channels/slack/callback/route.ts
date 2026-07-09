/**
 * Slack OAuth callback (Sprint 038).
 *
 * GET /api/channels/slack/callback?code=…&state=…
 *
 * Verifies the signed state against the CSRF cookie, exchanges the code for a
 * per-workspace bot token, and creates/refreshes the employee's active Slack
 * connection. The bot token is encrypted at rest and never touches the client.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import {
  exchangeCode,
  resolveRedirectUri,
  verifyState,
  SLACK_STATE_COOKIE,
} from "@/modules/channels/slack/oauth";
import { connectSlackWorkspace } from "@/modules/channels/slack/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const cookieState = cookies().get(SLACK_STATE_COOKIE)?.value;

  const { user, organization, membership } = await requireCurrentOrganization();

  const state = verifyState(stateParam);
  // CSRF: the signed state must match the cookie and be bound to this user + org.
  const valid =
    !!state &&
    !!cookieState &&
    stateParam === cookieState &&
    state.uid === user.id &&
    state.orgId === organization.id &&
    hasPermission(membership.role, "messaging_channel.manage");

  const back = state?.employeeId
    ? `/dashboard/employees/${state.employeeId}/channels/slack`
    : "/dashboard/employees";

  const clearCookie = (res: NextResponse) => {
    res.cookies.set(SLACK_STATE_COOKIE, "", { path: "/api/channels/slack", maxAge: 0 });
    return res;
  };

  if (!valid || !code) {
    return clearCookie(NextResponse.redirect(new URL(`${back}?error=denied`, request.url)));
  }

  const store = getStore();
  const employee = await store.getEmployee(organization.id, state.employeeId);
  if (!employee) {
    return clearCookie(NextResponse.redirect(new URL(`${back}?error=denied`, request.url)));
  }

  try {
    const install = await exchangeCode(code, resolveRedirectUri(request.url));
    await connectSlackWorkspace(
      store,
      { organizationId: organization.id, userId: user.id },
      { employee, install },
    );
  } catch {
    return clearCookie(NextResponse.redirect(new URL(`${back}?error=failed`, request.url)));
  }

  return clearCookie(NextResponse.redirect(new URL(`${back}?connected=1`, request.url)));
}
