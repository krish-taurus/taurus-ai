/**
 * Microsoft Teams / Bot Framework core (Sprint 043) — server only.
 *
 * Teams routes messages through the Bot Connector, which POSTs an Activity to our
 * messaging endpoint with a signed JWT. We validate that token, reply by POSTing
 * an Activity back to the Activity's serviceUrl (authenticated with an app
 * client-credentials token), and resolve the org from the Activity's tenant id.
 *
 * Full live validation needs an Azure Bot + AAD app registration; the token
 * verifier + connector calls here are pure/injectable so they are unit tested.
 */

import crypto from "node:crypto";

const CONNECTOR_TOKEN_URL = "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token";
const CONNECTOR_SCOPE = "https://api.botframework.com/.default";
const OPENID_CONFIG_URL = "https://login.botframework.com/v1/.well-known/openidconfiguration";

export class TeamsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamsError";
  }
}

export function isTeamsConfigured(): boolean {
  return !!(process.env.TEAMS_APP_ID && process.env.TEAMS_APP_PASSWORD);
}

/* -------------------------------------------------------------------------- */
/* Inbound Activity parsing                                                   */
/* -------------------------------------------------------------------------- */

export interface TeamsActivity {
  text: string;
  conversationId: string;
  serviceUrl: string;
  fromId: string;
  fromName: string | null;
  tenantId: string | null;
  activityId: string;
}

/** Parse a Bot Framework message Activity. Returns null for non-message events. */
export function parseActivity(json: unknown): TeamsActivity | null {
  const a = json as {
    type?: string;
    text?: string;
    id?: string;
    serviceUrl?: string;
    from?: { id?: string; name?: string };
    conversation?: { id?: string; tenantId?: string };
    channelData?: { tenant?: { id?: string } };
  };
  if (!a || a.type !== "message") return null;
  // Strip Teams <at>@bot</at> mention tags, then normalize.
  const text = (a.text ?? "").replace(/<at\b[^>]*>.*?<\/at>/gi, "").replace(/\s+/g, " ").trim();
  const conversationId = a.conversation?.id ?? "";
  const serviceUrl = a.serviceUrl ?? "";
  if (!text || !conversationId || !serviceUrl) return null;
  return {
    text,
    conversationId,
    serviceUrl,
    fromId: a.from?.id ?? "",
    fromName: a.from?.name ?? null,
    tenantId: a.conversation?.tenantId ?? a.channelData?.tenant?.id ?? null,
    activityId: a.id ?? "",
  };
}

/* -------------------------------------------------------------------------- */
/* Inbound JWT verification                                                   */
/* -------------------------------------------------------------------------- */

export interface RsaJwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
}

function b64urlToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function b64urlToJson(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(b64urlToBuffer(value).toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Verify a Bot Framework bearer token: RS256 signature against the connector
 * JWKS, audience === our app id, and unexpired. `jwks` + `nowSec` are injected
 * so this is fully unit tested.
 */
export function verifyInboundToken(input: {
  authHeader: string | null | undefined;
  appId: string;
  jwks: RsaJwk[];
  nowSec?: number;
}): boolean {
  const m = /^Bearer\s+(.+)$/i.exec(input.authHeader ?? "");
  if (!m) return false;
  const [h, p, s] = m[1].split(".");
  if (!h || !p || !s) return false;
  const header = b64urlToJson(h);
  const payload = b64urlToJson(p);
  if (!header || !payload) return false;
  if (payload.aud !== input.appId) return false;
  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  const skew = 300;
  if (typeof payload.exp === "number" && now > payload.exp + skew) return false;
  if (typeof payload.nbf === "number" && now < payload.nbf - skew) return false;

  const jwk = input.jwks.find((k) => k.kid === header.kid);
  if (!jwk) return false;
  try {
    const key = crypto.createPublicKey({
      key: jwk as unknown as crypto.JsonWebKey,
      format: "jwk",
    });
    return crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), key, b64urlToBuffer(s));
  } catch {
    return false;
  }
}

/** Fetch the Bot Framework signing keys (network; cached by the caller). */
export async function fetchConnectorJwks(): Promise<RsaJwk[]> {
  const cfg = (await (await fetch(OPENID_CONFIG_URL)).json()) as { jwks_uri?: string };
  if (!cfg.jwks_uri) return [];
  const keys = (await (await fetch(cfg.jwks_uri)).json()) as { keys?: RsaJwk[] };
  return keys.keys ?? [];
}

/* -------------------------------------------------------------------------- */
/* Outbound reply                                                             */
/* -------------------------------------------------------------------------- */

/** Get an app client-credentials token for the Bot Connector API. */
export async function getConnectorToken(appId: string, appPassword: string): Promise<string> {
  const res = await fetch(CONNECTOR_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: appId,
      client_secret: appPassword,
      scope: CONNECTOR_SCOPE,
    }).toString(),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new TeamsError(data.error_description ?? "Could not authenticate with Microsoft.");
  }
  return data.access_token;
}

/** Post a reply Activity to the conversation's serviceUrl. */
export async function sendReply(input: {
  serviceUrl: string;
  conversationId: string;
  text: string;
  token: string;
}): Promise<{ status: "sent" | "failed"; id: string | null; errorCode: string | null }> {
  const base = input.serviceUrl.replace(/\/$/, "");
  try {
    const res = await fetch(
      `${base}/v3/conversations/${encodeURIComponent(input.conversationId)}/activities`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${input.token}`,
        },
        body: JSON.stringify({ type: "message", text: input.text }),
      },
    );
    if (!res.ok) return { status: "failed", id: null, errorCode: `http_${res.status}` };
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { status: "sent", id: data.id ?? null, errorCode: null };
  } catch {
    return { status: "failed", id: null, errorCode: "network_error" };
  }
}
