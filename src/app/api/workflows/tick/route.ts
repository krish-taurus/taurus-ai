/**
 * Workflow scheduler tick (Sprint 050).
 *
 * POST /api/workflows/tick
 *
 * Taurus has no always-on worker, so scheduled workflows are driven by an
 * external timer (Vercel Cron, an uptime pinger, cron + curl) hitting this
 * route. Each call runs every active schedule-triggered workflow whose next run
 * is due and advances its next-run time. Gated by a shared secret so only your
 * cron can trigger it: set TAURUS_WORKFLOWS_TICK_SECRET and send it as
 * `Authorization: Bearer <secret>`. Without the secret it runs only in dev.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/store";
import { createLlmGateway, isProductionRuntime } from "@/modules/model-gateway/credential-resolver";
import { runDueScheduledWorkflows } from "@/modules/workflows/service";

export const dynamic = "force-dynamic";

function authorized(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.TAURUS_WORKFLOWS_TICK_SECRET?.trim();
  if (!secret) {
    // No secret configured: allow in dev for local testing, refuse in prod.
    if (isProductionRuntime()) {
      return { ok: false, status: 503, error: "The scheduler is not configured (set TAURUS_WORKFLOWS_TICK_SECRET)." };
    }
    return { ok: true };
  }
  const header = request.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "").trim();
  if (provided !== secret) return { ok: false, status: 401, error: "Not authorized." };
  return { ok: true };
}

export async function POST(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const store = getStore();
  const result = await runDueScheduledWorkflows(
    { store, gateway: createLlmGateway(store), isProduction: isProductionRuntime },
    Date.now(),
  );
  return NextResponse.json({ ok: true, started: result.started });
}
