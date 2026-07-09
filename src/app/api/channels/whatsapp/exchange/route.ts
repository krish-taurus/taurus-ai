/**
 * WhatsApp Embedded Signup exchange (Sprint 041).
 *
 * POST /api/channels/whatsapp/exchange   { employeeId, code, phoneNumberId }
 *
 * Called by the Embedded Signup component after the owner completes Meta's hosted
 * popup. Requires an authenticated channel manager (same-origin, session-based —
 * the org is resolved server-side, never from the body). Exchanges the code for a
 * business token and creates/refreshes the WhatsApp connection.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import {
  connectWhatsApp,
  exchangeCode,
  getPhoneNumber,
  isWhatsAppEmbeddedSignupConfigured,
} from "@/modules/channels/whatsapp/connect";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "messaging_channel.manage")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isWhatsAppEmbeddedSignupConfigured()) {
    return NextResponse.json({ error: "unavailable" }, { status: 400 });
  }

  let payload: { employeeId?: string; code?: string; phoneNumberId?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { employeeId, code, phoneNumberId } = payload;
  if (!employeeId || !code || !phoneNumberId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const store = getStore();
  const employee = await store.getEmployee(organization.id, employeeId);
  if (!employee) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const token = await exchangeCode(code);
    const number = await getPhoneNumber(token, phoneNumberId);
    await connectWhatsApp(
      store,
      { organizationId: organization.id, userId: user.id },
      { employee, token, number },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "WhatsApp sign-in could not be completed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
