/**
 * Advanced webhook signature verification (server only).
 *
 * Real, dependency-free (node:crypto) verifiers for provider webhook schemes that
 * go beyond the HMAC helpers in crypto.ts:
 *   - Ed25519         — Telnyx Call Control webhooks
 *   - ECDSA P-256     — SendGrid Signed Event Webhook
 *   - JWT (HS256)     — Vonage signed webhooks
 *
 * All functions are total and never throw — a malformed key/signature yields
 * `false` (fail-closed). Only reached from server webhook handlers.
 */

import crypto from "node:crypto";

/** SPKI DER prefix for a raw 32-byte Ed25519 public key. */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/**
 * Verify an Ed25519 signature. `publicKey` may be a base64 raw 32-byte key
 * (as Telnyx publishes) or a PEM/base64 SPKI key. `signature` is base64.
 */
export function verifyEd25519(
  publicKey: string,
  message: string,
  signatureBase64: string,
): boolean {
  try {
    const keyObject = ed25519KeyObject(publicKey);
    if (!keyObject) return false;
    const sig = Buffer.from(signatureBase64, "base64");
    if (sig.length !== 64) return false;
    return crypto.verify(null, Buffer.from(message, "utf8"), keyObject, sig);
  } catch {
    return false;
  }
}

function ed25519KeyObject(publicKey: string): crypto.KeyObject | null {
  const trimmed = publicKey.trim();
  if (trimmed.includes("BEGIN")) {
    return crypto.createPublicKey(trimmed);
  }
  const raw = Buffer.from(trimmed, "base64");
  if (raw.length === 32) {
    const spki = Buffer.concat([ED25519_SPKI_PREFIX, raw]);
    return crypto.createPublicKey({ key: spki, format: "der", type: "spki" });
  }
  // Assume a base64-encoded SPKI DER key otherwise.
  return crypto.createPublicKey({ key: raw, format: "der", type: "spki" });
}

/**
 * Verify an ECDSA P-256 (SHA-256) signature. `publicKey` is a PEM or base64 SPKI
 * EC public key (SendGrid's "Verification Key"); `signature` is base64 (DER).
 */
export function verifyEcdsaP256(
  publicKey: string,
  message: string,
  signatureBase64: string,
): boolean {
  try {
    const trimmed = publicKey.trim();
    const keyObject = trimmed.includes("BEGIN")
      ? crypto.createPublicKey(trimmed)
      : crypto.createPublicKey({
          key: Buffer.from(trimmed, "base64"),
          format: "der",
          type: "spki",
        });
    const verifier = crypto.createVerify("SHA256");
    verifier.update(message, "utf8");
    verifier.end();
    return verifier.verify(keyObject, Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}

export interface JwtVerifyResult {
  valid: boolean;
  payload: Record<string, unknown> | null;
}

/** Verify a compact JWS/JWT signed with HS256 using the shared secret. */
export function verifyJwtHs256(token: string, secret: string): JwtVerifyResult {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { valid: false, payload: null };
    const [headerB64, payloadB64, signatureB64] = parts;
    const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8")) as {
      alg?: string;
    };
    if (header.alg !== "HS256") return { valid: false, payload: null };

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest();
    const provided = Buffer.from(signatureB64, "base64url");
    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
      return { valid: false, payload: null };
    }
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    return { valid: true, payload };
  } catch {
    return { valid: false, payload: null };
  }
}

/** SHA-256 hex digest of a string (used for JWT payload-hash comparison). */
export function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}
