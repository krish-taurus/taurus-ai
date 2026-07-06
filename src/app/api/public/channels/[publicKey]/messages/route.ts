/**
 * Public channel message API (Prompt 008).
 *
 * POST /api/public/channels/[publicKey]/messages
 *
 * No dashboard auth. The organization is resolved from the channel PUBLIC KEY —
 * never from the client. Enforces origin allowlist (cross-origin), rate limits,
 * channel/employee/DNA status, and returns only safe public fields. Provider
 * errors are never leaked; no secrets or internal ids/paths are exposed.
 */

import { NextResponse } from "next/server";
import { getStore } from "@/lib/db/store";
import { getClientEnv } from "@/lib/env/env";
import { createLlmGateway, isProductionRuntime } from "@/modules/model-gateway/credential-resolver";
import { handlePublicChatMessage, PublicChannelError } from "@/modules/channels/runtime";
import { checkOrigin, hostnameFromOrigin } from "@/modules/channels/domains";
import { hashIp, hashUserAgent } from "@/modules/channels/keys";
import { checkChannelRateLimits, getRateLimiter } from "@/modules/channels/rate-limit";

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

const ERROR_STATUS: Record<string, number> = {
  not_found: 404,
  inactive: 403,
  not_available: 403,
  employee_unavailable: 409,
  needs_dna: 409,
  failed: 502,
};

const ERROR_MESSAGE: Record<string, string> = {
  not_found: "This chat is not available.",
  inactive: "This chat is currently unavailable.",
  not_available: "This channel is not available yet.",
  employee_unavailable: "This AI Employee is not available right now.",
  needs_dna: "This AI Employee is not ready to chat yet.",
  failed: "Sorry — something went wrong. Please try again.",
};

export async function POST(request: Request, { params }: { params: { publicKey: string } }) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const isDevelopment = !isProductionRuntime();

  let body: { sessionId?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400, origin);
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
  if (!message) return json({ error: "Please include a message." }, 400, origin);
  if (message.length > 4000) return json({ error: "That message is too long." }, 400, origin);

  const store = getStore();
  const channel = await store.getEmployeeChannelByPublicKey(params.publicKey);
  if (!channel) return json({ error: ERROR_MESSAGE.not_found }, 404, origin);

  // Origin allowlist — same-origin Taurus surfaces (hosted page / iframe) are
  // always allowed; cross-origin callers must pass the channel's allowlist.
  const appHost = hostnameFromOrigin(getClientEnv().NEXT_PUBLIC_APP_URL);
  const requestHost = hostnameFromOrigin(origin ?? referer);
  const isSameOrigin = !!requestHost && !!appHost && requestHost === appHost;
  if (!isSameOrigin) {
    const check = checkOrigin(origin ?? referer, channel.allowedDomains, { isDevelopment });
    if (!check.allowed) {
      return json({ error: "This website is not allowed to use this chat." }, 403, origin);
    }
  }

  // Rate limiting (per key / session / IP hash).
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : request.headers.get("x-real-ip");
  const ipHash = await hashIp(ip);
  const userAgentHash = await hashUserAgent(request.headers.get("user-agent"));

  const rate = checkChannelRateLimits(getRateLimiter(), {
    publicKey: channel.publicKey,
    sessionId,
    ipHash,
    perMinute: channel.rateLimitPerMinute,
    perDay: channel.rateLimitPerDay,
  });
  if (!rate.allowed) {
    return json(
      { error: "You're sending messages too quickly. Please wait a moment and try again." },
      429,
      origin,
    );
  }

  try {
    const result = await handlePublicChatMessage(
      { store, gateway: createLlmGateway(store) },
      {
        publicKey: params.publicKey,
        message,
        sessionId,
        originDomain: requestHost,
        ipHash,
        userAgentHash,
      },
    );

    return json(
      {
        sessionId: result.sessionId,
        message: result.outbound.text,
        sources: result.outbound.sources,
        employee: result.employee,
        metadata: {
          channelMode: channel.channelType,
          modelDisplayName: result.outbound.modelDisplayName,
          demoMode: result.outbound.demo,
        },
      },
      200,
      origin,
    );
  } catch (error) {
    if (error instanceof PublicChannelError) {
      return json({ error: ERROR_MESSAGE[error.code] }, ERROR_STATUS[error.code], origin);
    }
    // Never leak internal error details.
    return json({ error: ERROR_MESSAGE.failed }, 502, origin);
  }
}
