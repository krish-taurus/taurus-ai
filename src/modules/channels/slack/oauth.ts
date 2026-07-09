/**
 * Slack connect — OAuth install + request signing (Sprint 038) — server only.
 *
 * "Add to Slack" is a one-tap OAuth install: the owner authorizes the app in
 * their workspace and Slack returns a per-workspace bot token (xoxb-…). We never
 * ask them to paste a token. The OAuth `state` is HMAC-signed (AUTH_SECRET),
 * bound to the user + org + employee, and double-submitted via an httpOnly
 * cookie so a foreign callback is rejected.
 *
 * Inbound events are verified with the app signing secret (v0 HMAC over
 * `v0:{timestamp}:{body}`), and replies go out via chat.postMessage. No token
 * is ever exposed to the client.
 */

import crypto from "node:crypto";

export class SlackConnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlackConnectError";
  }
}

/** Cookie carrying the signed OAuth `state` (CSRF double-submit). */
export const SLACK_STATE_COOKIE = "taurus_slack_state";

/** Bot scopes: reply in channels, read DMs + @-mentions. */
export const SLACK_SCOPES = ["chat:write", "app_mentions:read", "im:history", "im:read"];

const STATE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_TIMESTAMP_SKEW_S = 60 * 5;

export function isSlackConfigured(): boolean {
  return !!(
    process.env.SLACK_CLIENT_ID &&
    process.env.SLACK_CLIENT_SECRET &&
    process.env.SLACK_SIGNING_SECRET
  );
}

function requireClientId(): string {
  const id = process.env.SLACK_CLIENT_ID;
  if (!id) throw new SlackConnectError("Slack is not configured on this server.");
  return id;
}

/* -------------------------------------------------------------------------- */
/* OAuth state (signed, bound to user + org + employee)                       */
/* -------------------------------------------------------------------------- */

export interface SlackOAuthState {
  uid: string;
  orgId: string;
  employeeId: string;
  nonce: string;
  iat: number;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Buffer): string {
  return bytes.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function stateSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new SlackConnectError("Server is missing AUTH_SECRET; cannot start Slack sign-in.");
  }
  return secret;
}

function hmacB64Url(data: string, secret: string): string {
  return toBase64Url(crypto.createHmac("sha256", secret).update(data).digest());
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function signState(state: SlackOAuthState): string {
  const encoded = toBase64Url(Buffer.from(encoder.encode(JSON.stringify(state))));
  return `${encoded}.${hmacB64Url(encoded, stateSecret())}`;
}

export function verifyState(token: string | undefined | null): SlackOAuthState | null {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  let expected: string;
  try {
    expected = hmacB64Url(encoded, stateSecret());
  } catch {
    return null;
  }
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as SlackOAuthState;
    if (typeof parsed.uid !== "string" || typeof parsed.orgId !== "string") return null;
    if (typeof parsed.employeeId !== "string") return null;
    if (typeof parsed.iat !== "number" || Date.now() - parsed.iat > STATE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Request signature verification (Slack v0)                                  */
/* -------------------------------------------------------------------------- */

/**
 * Verify a Slack request signature: `v0=` + HMAC-SHA256 over
 * `v0:{timestamp}:{rawBody}` with the signing secret. Rejects stale timestamps
 * (replay protection). `nowMs` is injectable for tests.
 */
export function verifySlackSignature(input: {
  signingSecret: string;
  timestamp: string | undefined;
  signature: string | undefined;
  rawBody: string;
  nowMs?: number;
}): boolean {
  const { signingSecret, timestamp, signature, rawBody } = input;
  if (!signingSecret || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = (input.nowMs ?? Date.now()) / 1000;
  if (Math.abs(now - ts) > MAX_TIMESTAMP_SKEW_S) return false;
  const expected =
    "v0=" +
    crypto.createHmac("sha256", signingSecret).update(`v0:${timestamp}:${rawBody}`).digest("hex");
  return timingSafeEqual(expected, signature);
}

/* -------------------------------------------------------------------------- */
/* OAuth flow                                                                 */
/* -------------------------------------------------------------------------- */

export function resolveRedirectUri(requestUrl: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const origin = configured ? configured.replace(/\/$/, "") : new URL(requestUrl).origin;
  return `${origin}/api/channels/slack/callback`;
}

export function buildInstallUrl(input: { state: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    client_id: requireClientId(),
    scope: SLACK_SCOPES.join(","),
    redirect_uri: input.redirectUri,
    state: input.state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export interface SlackInstall {
  botToken: string;
  teamId: string;
  teamName: string | null;
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Exchange the OAuth `code` for a per-workspace bot token via oauth.v2.access. */
export async function exchangeCode(code: string, redirectUri: string): Promise<SlackInstall> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new SlackConnectError("Slack is not configured on this server.");
  }
  const res = await timedFetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    access_token?: string;
    team?: { id?: string; name?: string };
  };
  if (!data.ok || !data.access_token || !data.team?.id) {
    throw new SlackConnectError(
      data.error ? `Slack sign-in failed (${data.error}).` : "Slack sign-in could not be completed.",
    );
  }
  return {
    botToken: data.access_token,
    teamId: data.team.id,
    teamName: data.team.name ?? null,
  };
}
