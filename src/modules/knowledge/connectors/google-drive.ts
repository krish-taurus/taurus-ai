import "server-only";

/**
 * Google Drive knowledge connector (Sprint 023).
 *
 * Connect a Google Drive account (read-only) and turn a Drive **file or folder**
 * into searchable Knowledge Vault documents an AI Employee can answer from. Reuses
 * the existing extraction (PDF / DOCX / text) → index → hybrid-retrieval pipeline;
 * this module only adds the OAuth handshake + Drive fetch/export in front of it.
 *
 * SAFETY / SCOPE:
 *  - OAuth scope is `drive.readonly` — the app can never modify the user's Drive.
 *  - The OAuth `state` is HMAC-signed (AUTH_SECRET) and bound to the user + org,
 *    and double-submitted via an httpOnly cookie, so a foreign callback is rejected.
 *  - The refresh token is stored encrypted at rest (same AES-GCM as model keys) and
 *    is never returned to the browser; only the connected account email is shown.
 *  - Ingestion is bounded: a folder is read one level deep, capped file count/size,
 *    and each file's text is capped by the shared extractor.
 *
 * Setup (Google Cloud), one-time — see docs/connectors/google-drive.md:
 *  - Create an OAuth client (Web application) and enable the Google Drive API.
 *  - Authorized redirect URI: `<app-origin>/api/knowledge/connectors/google-drive/callback`.
 *  - Set GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET (and optionally
 *    GOOGLE_DRIVE_REDIRECT_URI) in the environment.
 */

import { extractFileText } from "@/modules/knowledge/extraction";
import { ALLOWED_EXTENSIONS, fileExtension } from "@/modules/knowledge/metadata";
import { encryptApiKey, decryptApiKey } from "@/modules/model-gateway/credentials";
import type { DocumentExtractionStatus } from "@/lib/db/types";

/** Cookie carrying the signed OAuth `state` (CSRF double-submit). */
export const OAUTH_STATE_COOKIE = "taurus_gdrive_state";
/** Cookie carrying the just-connected account between callback and form submit. */
export const PENDING_COOKIE = "taurus_gdrive_pending";
/** How long a just-connected account stays usable before the form submit (ms). */
const PENDING_TTL_MS = 15 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

export const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MAX_FILES = 50;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // skip Drive files larger than 10 MB
const FETCH_TIMEOUT_MS = 20_000;
const STATE_TTL_MS = 10 * 60 * 1000; // OAuth round-trip window

export class GoogleDriveConnectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleDriveConnectorError";
  }
}

/** True when the Google OAuth client is configured (gates the connector UI). */
export function isGoogleDriveConfigured(): boolean {
  return (
    !!process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() &&
    !!process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim()
  );
}

function requireClientId(): string {
  const id = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  if (!id) throw new GoogleDriveConnectorError("Google Drive is not configured.");
  return id;
}

function requireClientSecret(): string {
  const secret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
  if (!secret) throw new GoogleDriveConnectorError("Google Drive is not configured.");
  return secret;
}

/**
 * The OAuth redirect URI. Must match a value registered in the Google Cloud OAuth
 * client. Prefers the explicit env var; otherwise derives it from the request
 * origin so preview/prod deployments work without extra config.
 */
export function resolveRedirectUri(requestUrl: string): string {
  const explicit = process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${new URL(requestUrl).origin}/api/knowledge/connectors/google-drive/callback`;
}

/* -------------------------------------------------------------------------- */
/* OAuth state (signed, bound to user + org)                                  */
/* -------------------------------------------------------------------------- */

export interface OAuthState {
  uid: string;
  orgId: string;
  nonce: string;
  iat: number;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
}

function stateSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new GoogleDriveConnectorError("Server is missing AUTH_SECRET; cannot start Google sign-in.");
  }
  return secret;
}

async function hmac(data: string, secret: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

/** Encode + sign an OAuth state value (CSRF + user/org binding). */
export async function signState(state: OAuthState): Promise<string> {
  const encoded = toBase64Url(encoder.encode(JSON.stringify(state)));
  const sig = await hmac(encoded, stateSecret());
  return `${encoded}.${sig}`;
}

/** Verify + decode an OAuth state value. Returns null if tampered or expired. */
export async function verifyState(token: string | undefined | null): Promise<OAuthState | null> {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  let expected: string;
  try {
    expected = await hmac(encoded, stateSecret());
  } catch {
    return null;
  }
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as OAuthState;
    if (typeof parsed.uid !== "string" || typeof parsed.orgId !== "string") return null;
    if (typeof parsed.iat !== "number" || Date.now() - parsed.iat > STATE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* OAuth flow                                                                 */
/* -------------------------------------------------------------------------- */

/** Build the Google consent URL for the read-only Drive scope. */
export function buildConsentUrl(input: { state: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    client_id: requireClientId(),
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: GOOGLE_DRIVE_SCOPES.join(" "),
    access_type: "offline", // returns a refresh token
    prompt: "consent", // force a refresh token even on re-consent
    include_granted_scopes: "true",
    state: input.state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface DriveTokens {
  accessToken: string;
  refreshToken: string | null;
}

/** Exchange an authorization code for tokens. */
export async function exchangeCodeForTokens(input: {
  code: string;
  redirectUri: string;
}): Promise<DriveTokens> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: requireClientId(),
    client_secret: requireClientSecret(),
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await timedFetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new GoogleDriveConnectorError("Google sign-in could not be completed. Please try again.");
  }
  const json = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!json.access_token) {
    throw new GoogleDriveConnectorError("Google did not return an access token.");
  }
  return { accessToken: json.access_token, refreshToken: json.refresh_token ?? null };
}

/** Trade a stored refresh token for a fresh access token (used on sync). */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: requireClientId(),
    client_secret: requireClientSecret(),
    grant_type: "refresh_token",
  });
  const res = await timedFetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new GoogleDriveConnectorError(
      "The Google Drive connection has expired. Please reconnect the account.",
    );
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new GoogleDriveConnectorError("Google did not return an access token.");
  }
  return json.access_token;
}

/** Fetch the connected account's email (for display only). */
export async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await timedFetch(USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { email?: string };
    return json.email ?? null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Pending-connection handoff (encrypted cookie)                              */
/* -------------------------------------------------------------------------- */

export interface PendingConnection {
  refreshToken: string;
  email: string | null;
}

/**
 * Encrypt the just-connected account into an opaque cookie value. The refresh
 * token is a long-lived secret, so it is AES-GCM encrypted (never plaintext) and
 * the cookie itself must be set httpOnly by the caller.
 */
export async function encodePendingConnection(input: PendingConnection): Promise<string> {
  return encryptApiKey(JSON.stringify({ ...input, iat: Date.now() }));
}

/** Decrypt + validate the pending-connection cookie. Null if missing/expired. */
export async function decodePendingConnection(
  value: string | undefined | null,
): Promise<PendingConnection | null> {
  if (!value) return null;
  try {
    const parsed = JSON.parse(await decryptApiKey(value)) as PendingConnection & { iat?: number };
    if (!parsed.refreshToken) return null;
    if (typeof parsed.iat !== "number" || Date.now() - parsed.iat > PENDING_TTL_MS) return null;
    return { refreshToken: parsed.refreshToken, email: parsed.email ?? null };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Drive file/folder link parsing                                             */
/* -------------------------------------------------------------------------- */

/**
 * Extract a Drive file/folder id from any of the common link shapes, or accept a
 * raw id. The connector decides file-vs-folder from the fetched mime type, so we
 * only need the id here.
 */
export function parseDriveId(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;
  // Raw id (no slashes / scheme).
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input) && !input.includes("/")) return input;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!host.endsWith("google.com")) return null;

  // .../folders/<id>, .../file/d/<id>/..., docs .../document/d/<id>/...
  const segments = url.pathname.split("/").filter(Boolean);
  const dIndex = segments.indexOf("d");
  if (dIndex >= 0 && segments[dIndex + 1]) return segments[dIndex + 1];
  const folderIndex = segments.indexOf("folders");
  if (folderIndex >= 0 && segments[folderIndex + 1]) return segments[folderIndex + 1];

  // .../open?id=<id> or ?id=<id>
  const idParam = url.searchParams.get("id");
  if (idParam) return idParam;

  return null;
}

/* -------------------------------------------------------------------------- */
/* Drive fetch + export → text                                                */
/* -------------------------------------------------------------------------- */

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
}

/** How to turn a Drive file into bytes we can extract, or null if unsupported. */
export function planForMime(
  mimeType: string,
  fileName: string,
): { mode: "download" | "export"; exportMime?: string; extension: string } | null {
  switch (mimeType) {
    case "application/vnd.google-apps.document":
      return { mode: "export", exportMime: DOCX_MIME, extension: ".docx" };
    case "application/vnd.google-apps.spreadsheet":
      return { mode: "export", exportMime: "text/csv", extension: ".csv" };
    case "application/vnd.google-apps.presentation":
      return { mode: "export", exportMime: "text/plain", extension: ".txt" };
    case "application/pdf":
      return { mode: "download", extension: ".pdf" };
    case DOCX_MIME:
      return { mode: "download", extension: ".docx" };
    case "text/plain":
      return { mode: "download", extension: ".txt" };
    case "text/markdown":
      return { mode: "download", extension: ".md" };
    case "text/csv":
      return { mode: "download", extension: ".csv" };
    case "application/json":
      return { mode: "download", extension: ".json" };
    default: {
      // Unknown/generic mime (e.g. application/octet-stream) — trust a supported
      // file extension if the name has one.
      const ext = fileExtension(fileName);
      if (ext && ALLOWED_EXTENSIONS.includes(ext)) return { mode: "download", extension: ext };
      return null;
    }
  }
}

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getFileMeta(accessToken: string, id: string): Promise<DriveFile> {
  const url = `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(id)}?fields=id,name,mimeType,size&supportsAllDrives=true`;
  const res = await timedFetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (res.status === 404) throw new GoogleDriveConnectorError("That Drive item was not found (check sharing/access).");
  if (!res.ok) throw new GoogleDriveConnectorError("Could not read that item from Google Drive.");
  const json = (await res.json()) as DriveFile & { size?: string };
  return { id: json.id, name: json.name, mimeType: json.mimeType, size: json.size ? Number(json.size) : undefined };
}

async function listFolderChildren(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id,name,mimeType,size)",
      pageSize: "100",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await timedFetch(`${DRIVE_FILES_ENDPOINT}?${params.toString()}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new GoogleDriveConnectorError("Could not list that Drive folder.");
    const json = (await res.json()) as {
      files?: Array<DriveFile & { size?: string }>;
      nextPageToken?: string;
    };
    for (const f of json.files ?? []) {
      files.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size ? Number(f.size) : undefined,
      });
      if (files.length >= MAX_FILES) return files;
    }
    pageToken = json.nextPageToken;
  } while (pageToken);
  return files;
}

async function downloadFileBytes(
  accessToken: string,
  file: DriveFile,
  plan: NonNullable<ReturnType<typeof planForMime>>,
): Promise<Uint8Array> {
  const url =
    plan.mode === "export"
      ? `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(plan.exportMime as string)}`
      : `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`;
  const res = await timedFetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new GoogleDriveConnectorError(`Could not download "${file.name}" from Google Drive.`);
  return new Uint8Array(await res.arrayBuffer());
}

export interface DriveDocument {
  title: string;
  text: string | null;
  status: DocumentExtractionStatus;
}

export interface DriveIngestResult {
  /** Display name of the source (the folder or single file name). */
  rootName: string;
  documents: DriveDocument[];
  /** Files skipped because their type isn't supported. */
  skipped: number;
}

/**
 * Read a Drive file or folder into extracted-text documents. A folder is read one
 * level deep (bounded by MAX_FILES); a single file yields one document. Unsupported
 * or oversized files are skipped, not failed, so one bad file never blocks the rest.
 */
export async function ingestDriveSource(input: {
  accessToken: string;
  rootId: string;
}): Promise<DriveIngestResult> {
  const root = await getFileMeta(input.accessToken, input.rootId);

  const targets =
    root.mimeType === FOLDER_MIME
      ? await listFolderChildren(input.accessToken, root.id)
      : [root];

  const documents: DriveDocument[] = [];
  let skipped = 0;

  for (const file of targets) {
    if (file.mimeType === FOLDER_MIME) {
      skipped += 1; // nested folders aren't recursed in this version
      continue;
    }
    const plan = planForMime(file.mimeType, file.name);
    if (!plan) {
      skipped += 1;
      continue;
    }
    if (file.size !== undefined && file.size > MAX_FILE_BYTES) {
      documents.push({ title: file.name, text: null, status: "failed" });
      continue;
    }
    try {
      const bytes = await downloadFileBytes(input.accessToken, file, plan);
      const extracted = await extractFileText(bytes, plan.extension);
      documents.push({ title: file.name, text: extracted.text, status: extracted.status });
    } catch {
      documents.push({ title: file.name, text: null, status: "failed" });
    }
    if (documents.length >= MAX_FILES) break;
  }

  return { rootName: root.name, documents, skipped };
}
