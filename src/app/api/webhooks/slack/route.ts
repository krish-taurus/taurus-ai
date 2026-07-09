/**
 * Slack Events API endpoint (Sprint 038).
 *
 * POST /api/webhooks/slack
 *
 * No dashboard auth. Handles Slack's url_verification handshake and event
 * callbacks. The workspace (and therefore org) is resolved from the payload's
 * team_id inside the service — never from client input; the request signature is
 * verified with the app signing secret. The raw body is read as text so the
 * signature covers exact bytes.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/store";
import { createLlmGateway } from "@/modules/model-gateway/credential-resolver";
import { processSlackEvent } from "@/modules/channels/slack/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const rawBody = await request.text();

  const store = getStore();
  const result = await processSlackEvent(
    { store, gateway: createLlmGateway(store) },
    { rawBody, headers },
  );

  return new NextResponse(result.body, {
    status: result.status,
    headers: result.contentType ? { "content-type": result.contentType } : undefined,
  });
}
