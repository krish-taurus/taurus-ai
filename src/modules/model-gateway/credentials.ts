/**
 * Provider credential encryption (Prompt 006B) — SERVER ONLY.
 *
 * Bring-your-own-key (BYOK) API keys are encrypted at rest with AES-256-GCM. The
 * key is derived from TAURUS_MODEL_CREDENTIALS_MASTER_KEY via SHA-256, so any
 * sufficiently long master string works. Plaintext keys are NEVER stored, and
 * the encrypted value is NEVER returned to the client (only key_last_four).
 *
 * If the master key is not configured, BYOK is disabled — the UI must not offer
 * it, and callers must check isEncryptionConfigured() before encrypting.
 */

const MIN_MASTER_KEY_LENGTH = 16;
const IV_BYTES = 12;

/** True when a usable master key is configured (gates all BYOK features). */
export function isEncryptionConfigured(): boolean {
  const key = process.env.TAURUS_MODEL_CREDENTIALS_MASTER_KEY ?? "";
  return key.trim().length >= MIN_MASTER_KEY_LENGTH;
}

function requireMasterKey(): string {
  const key = process.env.TAURUS_MODEL_CREDENTIALS_MASTER_KEY ?? "";
  if (key.trim().length < MIN_MASTER_KEY_LENGTH) {
    throw new Error("Credential encryption is not configured.");
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
 * Encrypt a plaintext API key. Returns an opaque "iv.ciphertext" base64 string
 * suitable for storage in organization_provider_credentials.encrypted_api_key.
 */
export async function encryptApiKey(plaintext: string): Promise<string> {
  const key = await deriveAesKey(requireMasterKey());
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

/** Decrypt a stored value produced by encryptApiKey. Server-only. */
export async function decryptApiKey(encrypted: string): Promise<string> {
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

/** Last four characters of a key for safe display (never the full key). */
export function lastFour(plaintext: string): string {
  const trimmed = plaintext.trim();
  return trimmed.length <= 4 ? trimmed : trimmed.slice(-4);
}
