/**
 * Signed session tokens (Prompt 002).
 *
 * A session token is `base64url(payload).base64url(hmacSHA256(payload))`, where
 * payload is JSON `{ uid, iat }`. Signing uses AUTH_SECRET via the Web Crypto
 * API so the same code runs in both the Edge middleware and the Node server.
 *
 * This is a foundation session mechanism. Credential verification is delegated
 * to an auth provider (see src/modules/auth/provider.ts); this module only
 * proves "the server issued this session for user <uid>". No secrets are
 * hardcoded — AUTH_SECRET must be provided via the environment.
 */

export const SESSION_COOKIE = "taurus_session";

export interface SessionPayload {
  uid: string;
  iat: number;
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short (min 16 chars). Set it in your environment " +
        "before using authentication. See .env.example.",
    );
  }
  return secret;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(signature));
}

/** Constant-time comparison of two base64url strings. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function createSessionToken(uid: string): Promise<string> {
  const secret = getSecret();
  const payload: SessionPayload = { uid, iat: Date.now() };
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

/** Verify a token and return its payload, or null if invalid/tampered. */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;

  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return null;
  }

  const expected = await sign(encodedPayload, secret);
  if (!timingSafeEqual(signature, expected)) return null;

  try {
    const json = new TextDecoder().decode(fromBase64Url(encodedPayload));
    const payload = JSON.parse(json) as SessionPayload;
    if (typeof payload.uid !== "string" || typeof payload.iat !== "number") return null;
    return payload;
  } catch {
    return null;
  }
}
