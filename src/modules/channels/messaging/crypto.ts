/**
 * Webhook signature helpers (Prompt 009) — server only.
 *
 * Small HMAC helpers used by provider adapters to verify webhook authenticity.
 * Dependency-free (Web Crypto). Timing-safe comparison avoids leaking via early
 * exit.
 */

function enc(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function hmac(algo: "SHA-1" | "SHA-256", key: string, data: string): Promise<Uint8Array> {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    enc(key),
    { name: "HMAC", hash: algo },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, enc(data));
  return new Uint8Array(sig);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export async function hmacHex(
  algo: "SHA-1" | "SHA-256",
  key: string,
  data: string,
): Promise<string> {
  return toHex(await hmac(algo, key, data));
}

export async function hmacBase64(
  algo: "SHA-1" | "SHA-256",
  key: string,
  data: string,
): Promise<string> {
  return toBase64(await hmac(algo, key, data));
}

/** Constant-time string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
