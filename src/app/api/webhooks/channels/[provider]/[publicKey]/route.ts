/**
 * Messaging provider webhook endpoint (Prompt 009).
 *
 * POST /api/webhooks/channels/{provider}/{publicKey}
 *   providers: twilio | meta-whatsapp | sendgrid | mailgun | custom
 * GET  /api/webhooks/channels/meta-whatsapp/{publicKey}  (Meta verification)
 *
 * No dashboard auth. The channel + organization are resolved from the URL public
 * key — never from client input. Signatures are verified when configured; in
 * local development unverified requests are accepted in simulated mode only.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/store";
import { createLlmGateway } from "@/modules/model-gateway/credential-resolver";
import { processMessagingWebhook } from "@/modules/channels/messaging/webhook";
import { metaVerifyChallenge } from "@/modules/channels/messaging/providers/meta-whatsapp";
import type { WebhookRequest } from "@/modules/channels/messaging/types";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { provider: string; publicKey: string } },
) {
  // Only Meta WhatsApp uses a GET verification challenge.
  if (params.provider !== "meta-whatsapp") {
    return new NextResponse("Method not allowed", { status: 405 });
  }
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const challenge = metaVerifyChallenge(query, process.env.META_WHATSAPP_VERIFY_TOKEN);
  if (challenge === null) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: { provider: string; publicKey: string } },
) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  const url = request.url;
  const query = Object.fromEntries(new URL(url).searchParams);
  const contentType = headers["content-type"] ?? "";

  let rawBody = "";
  let form: Record<string, string> = {};
  let json: unknown = null;

  try {
    if (contentType.includes("multipart/form-data")) {
      const fd = await request.formData();
      for (const [key, value] of fd.entries()) {
        if (typeof value === "string") form[key] = value;
      }
    } else {
      rawBody = await request.text();
      if (contentType.includes("json")) {
        try {
          json = JSON.parse(rawBody);
        } catch {
          json = null;
        }
      } else if (contentType.includes("x-www-form-urlencoded")) {
        form = Object.fromEntries(new URLSearchParams(rawBody));
      } else if (rawBody) {
        try {
          json = JSON.parse(rawBody);
        } catch {
          json = null;
        }
      }
    }
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const webhookRequest: WebhookRequest = {
    method: "POST",
    url,
    headers,
    query,
    rawBody,
    form,
    json,
  };

  const store = getStore();
  const result = await processMessagingWebhook(
    { store, gateway: createLlmGateway(store) },
    { providerSlug: params.provider, publicKey: params.publicKey, request: webhookRequest },
  );

  return new NextResponse(result.body, {
    status: result.status,
    headers: result.contentType ? { "content-type": result.contentType } : undefined,
  });
}
