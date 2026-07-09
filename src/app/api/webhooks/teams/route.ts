/**
 * Microsoft Teams (Bot Framework) messaging endpoint (Sprint 043).
 *
 * POST /api/webhooks/teams
 *
 * No dashboard auth. The Bot Connector POSTs an Activity with a signed JWT; the
 * service validates the token, resolves the org from the Activity's tenant id
 * (never client input), and replies via the Connector. The raw body is read as
 * text so verification covers exact bytes.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/store";
import { createLlmGateway } from "@/modules/model-gateway/credential-resolver";
import { processTeamsActivity } from "@/modules/channels/teams/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const rawBody = await request.text();

  const store = getStore();
  const result = await processTeamsActivity(
    { store, gateway: createLlmGateway(store) },
    { rawBody, headers },
  );
  return new NextResponse(result.body, { status: result.status });
}
