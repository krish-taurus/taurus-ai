/**
 * Knowledge Vault local file storage (Prompt 006) — server only.
 *
 * Uploaded files are stored on the local filesystem (default: storage/uploads,
 * gitignored) under an opaque, per-organization key. Files are NEVER placed in
 * public/ and NEVER served directly — access goes through authenticated,
 * organization-scoped server routes. Raw filenames are never used as paths.
 *
 * The pure helpers (sanitizeFilename, buildStorageKey, sha256Hex, decodeUtf8,
 * makePreview) have no filesystem dependency and are unit-tested directly.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { KnowledgeStorage } from "@/modules/knowledge/service";

/** Sanitize a user-supplied filename for safe DISPLAY (never used as a path). */
export function sanitizeFilename(name: string): string {
  const base = name.replace(/^.*[\\/]/, ""); // drop any path segments
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._]+/, "")
    .slice(0, 120);
  return cleaned || "document";
}

/**
 * Build an opaque storage key from a random uuid + a validated extension.
 * The caller supplies the extension (already checked against the allowlist), so
 * the raw filename never influences the on-disk path.
 */
export function buildStorageKey(extension: string): string {
  const ext = extension.startsWith(".") ? extension.toLowerCase() : "";
  const safeExt = /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
  return `${globalThis.crypto.randomUUID()}${safeExt}`;
}

/** SHA-256 hex digest of the given bytes. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Decode bytes as UTF-8 text (used for txt/md/csv/json). */
export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/** Build a short, single-line-ish preview from extracted text. */
export function makePreview(text: string, max = 600): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

/** Root directory for uploads. Configurable via TAURUS_UPLOAD_DIR. */
export function getUploadRoot(): string {
  return resolve(process.env.TAURUS_UPLOAD_DIR || "storage/uploads");
}

/**
 * Local filesystem implementation of the KnowledgeStorage interface. Writes each
 * file to <uploadRoot>/<organizationId>/<storageKey>. The organization id is a
 * uuid and the storage key is opaque, so paths are safe.
 */
export class LocalKnowledgeStorage implements KnowledgeStorage {
  private pathFor(organizationId: string, storageKey: string): string {
    // Guard against traversal even though inputs are uuid/opaque.
    if (storageKey.includes("/") || storageKey.includes("\\") || storageKey.includes("..")) {
      throw new Error("Invalid storage key.");
    }
    return join(getUploadRoot(), organizationId, storageKey);
  }

  async save(input: {
    organizationId: string;
    storageKey: string;
    bytes: Uint8Array;
  }): Promise<void> {
    const path = this.pathFor(input.organizationId, input.storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.bytes);
  }

  async read(organizationId: string, storageKey: string): Promise<Uint8Array> {
    const path = this.pathFor(organizationId, storageKey);
    return new Uint8Array(await readFile(path));
  }
}

/** Shared local storage adapter instance for server actions/routes. */
export const localKnowledgeStorage = new LocalKnowledgeStorage();
