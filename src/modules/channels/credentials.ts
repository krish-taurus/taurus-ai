/**
 * Channel provider credential encryption (Prompt 009) — SERVER ONLY.
 *
 * Messaging provider secrets (Twilio auth token, Meta access token, SendGrid /
 * Mailgun API keys) are encrypted at rest with AES-256-GCM, keyed off
 * TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY. Plaintext is NEVER stored and the
 * encrypted value is NEVER returned to the client (only provider type, label,
 * and key_last_four are shown).
 *
 * If the master key is not configured, bring-your-own-key is disabled — callers
 * must check isChannelEncryptionConfigured() before encrypting.
 */

const MIN_MASTER_KEY_LENGTH = 16;
const IV_BYTES = 12;

/** True when a usable master key is configured (gates BYOK credential storage). */
export function isChannelEncryptionConfigured(): boolean {
  const key = process.env.TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY ?? "";
  return key.trim().length >= MIN_MASTER_KEY_LENGTH;
}

function requireMasterKey(): string {
  const key = process.env.TAURUS_CHANNEL_CREDENTIALS_MASTER_KEY ?? "";
  if (key.trim().length < MIN_MASTER_KEY_LENGTH) {
    throw new Error("Channel credential encryption is not configured.");
  }
  return key;
}

async function deriveAesKey(master: string): Promise<CryptoKey> {
  const material = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(master),
  );
  return globalThis.crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

/**
 * Encrypt a provider credential secret bundle (already JSON-serialized). Returns
 * an opaque "iv.ciphertext" base64 string for storage in
 * channel_provider_credentials.encrypted_credentials.
 */
export async function encryptCredentials(plaintext: string): Promise<string> {
  const key = await deriveAesKey(requireMasterKey());
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

/** Decrypt a stored credential bundle. Server-only; never exposed to the client. */
export async function decryptCredentials(encrypted: string): Promise<string> {
  const [ivPart, ctPart] = encrypted.split(".");
  if (!ivPart || !ctPart) throw new Error("Malformed encrypted credential.");
  const key = await deriveAesKey(requireMasterKey());
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivPart) },
    key,
    fromBase64(ctPart),
  );
  return new TextDecoder().decode(plaintext);
}

/** Last four characters of a secret for safe display (never the full value). */
export function lastFour(value: string): string {
  const trimmed = value.trim();
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
}
