/**
 * Channel keys + privacy-preserving hashing (Prompt 008) — server only.
 *
 * Public keys are opaque and safe to embed in browser code. IP addresses and
 * user-agents are NEVER stored raw — only salted SHA-256 hashes (truncated).
 */

function uuidHex(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "");
}

/** An opaque, URL-safe public channel key (safe to embed publicly). */
export function generatePublicKey(): string {
  return `tc_${uuidHex()}`;
}

/** A random per-visitor id (used when the client does not supply one). */
export function generateVisitorId(): string {
  return `v_${uuidHex()}`;
}

function salt(): string {
  // Reuse the app secret as a hashing salt when present; a fixed fallback keeps
  // local dev deterministic without leaking anything sensitive.
  return process.env.AUTH_SECRET || "taurus-channel-salt";
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Salted, truncated hash of an IP address (never store the raw IP). */
export async function hashIp(ip: string | null | undefined): Promise<string | null> {
  if (!ip) return null;
  return (await sha256Hex(`ip:${salt()}:${ip}`)).slice(0, 32);
}

/** Salted, truncated hash of a user-agent string. */
export async function hashUserAgent(ua: string | null | undefined): Promise<string | null> {
  if (!ua) return null;
  return (await sha256Hex(`ua:${salt()}:${ua}`)).slice(0, 32);
}

/** Hash a channel secret for at-rest storage (foundation for future channels). */
export async function hashSecret(secret: string): Promise<string> {
  return sha256Hex(`secret:${salt()}:${secret}`);
}

/** Salted hash of a messaging contact id (phone/email) — never store it raw. */
export async function hashContact(value: string): Promise<string> {
  return (await sha256Hex(`contact:${salt()}:${value.trim().toLowerCase()}`)).slice(0, 40);
}
