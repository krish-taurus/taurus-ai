import "server-only";

/**
 * SharePoint / OneDrive knowledge connector (Sprint 027).
 *
 * Connect a Microsoft account (read-only) and import a **OneDrive or SharePoint
 * file or folder** from a sharing link — its files' text becomes searchable
 * Knowledge Vault documents an AI Employee can answer from. Reuses the existing
 * extraction (PDF / DOCX / text) → index → hybrid-retrieval pipeline; this module
 * adds the Microsoft OAuth handshake + Microsoft Graph fetch in front of it.
 *
 * A single **sharing link** works for both OneDrive and SharePoint: Graph's
 * `/shares/{id}/driveItem` resolves the link to a drive item, then we read the
 * file (or list a folder) via the drive.
 *
 * SAFETY / SCOPE:
 *  - OAuth scopes are `Files.Read.All` + `Sites.Read.All` (+ `offline_access`,
 *    `User.Read`) — read-only; the app can never modify the user's content.
 *  - The OAuth `state` is HMAC-signed (AUTH_SECRET), bound to the user + org, and
 *    double-submitted via an httpOnly cookie, so a foreign callback is rejected.
 *  - The refresh token is stored encrypted at rest (same AES-GCM as model keys)
 *    and never returned to the browser; only the connected account email is shown.
 *  - Ingestion is bounded: a folder is read one level deep, capped file count/size.
 *
 * Setup (Azure AD app registration), one-time — see docs/connectors/sharepoint.md.
 */

import { extractFileText } from "@/modules/knowledge/extraction";
import { ALLOWED_EXTENSIONS, fileExtension } from "@/modules/knowledge/metadata";
import { encryptApiKey, decryptApiKey } from "@/modules/model-gateway/credentials";
import type { DocumentExtractionStatus } from "@/lib/db/types";

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

export const SHAREPOINT_SCOPES = [
  "offline_access",
  "User.Read",
  "Files.Read.All",
  "Sites.Read.All",
];

const GRAPH = "https://graph.microsoft.com/v1.0";

/** Cookie carrying the signed OAuth `state` (CSRF double-submit). */
export const OAUTH_STATE_COOKIE = "taurus_msft_state";
/** Cookie carrying the just-connected account between callback and form submit. */
export const PENDING_COOKIE = "taurus_msft_pending";
const PENDING_TTL_MS = 15 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;

const MAX_FILES = 50;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

export class SharePointConnectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SharePointConnectorError";
  }
}

function tenant(): string {
  return process.env.MICROSOFT_TENANT?.trim() || "common";
}

/** True when the Microsoft OAuth client is configured (gates the connector UI). */
export function isSharePointConfigured(): boolean {
  return (
    !!process.env.MICROSOFT_CLIENT_ID?.trim() && !!process.env.MICROSOFT_CLIENT_SECRET?.trim()
  );
}

function requireClientId(): string {
  const id = process.env.MICROSOFT_CLIENT_ID?.trim();
  if (!id) throw new SharePointConnectorError("SharePoint / OneDrive is not configured.");
  return id;
}

function requireClientSecret(): string {
  const secret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
  if (!secret) throw new SharePointConnectorError("SharePoint / OneDrive is not configured.");
  return secret;
}

export function resolveRedirectUri(requestUrl: string): string {
  const explicit = process.env.MICROSOFT_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${new URL(requestUrl).origin}/api/knowledge/connectors/sharepoint/callback`;
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
    throw new SharePointConnectorError("Server is missing AUTH_SECRET; cannot start Microsoft sign-in.");
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

export async function signState(state: OAuthState): Promise<string> {
  const encoded = toBase64Url(encoder.encode(JSON.stringify(state)));
  const sig = await hmac(encoded, stateSecret());
  return `${encoded}.${sig}`;
}

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
/* Pending-connection handoff (encrypted cookie)                              */
/* -------------------------------------------------------------------------- */

export interface PendingConnection {
  refreshToken: string;
  email: string | null;
}

export async function encodePendingConnection(input: PendingConnection): Promise<string> {
  return encryptApiKey(JSON.stringify({ ...input, iat: Date.now() }));
}

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
/* OAuth flow                                                                 */
/* -------------------------------------------------------------------------- */

export function buildConsentUrl(input: { state: string; redirectUri: string }): string {
  const params = new URLSearchParams({
    client_id: requireClientId(),
    response_type: "code",
    redirect_uri: input.redirectUri,
    response_mode: "query",
    scope: SHAREPOINT_SCOPES.join(" "),
    state: input.state,
    prompt: "select_account",
  });
  return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize?${params.toString()}`;
}

export interface MsftTokens {
  accessToken: string;
  refreshToken: string | null;
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

export async function exchangeCodeForTokens(input: {
  code: string;
  redirectUri: string;
}): Promise<MsftTokens> {
  const res = await timedFetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireClientId(),
      client_secret: requireClientSecret(),
      code: input.code,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
      scope: SHAREPOINT_SCOPES.join(" "),
    }),
  });
  if (!res.ok) {
    throw new SharePointConnectorError("Microsoft sign-in could not be completed. Please try again.");
  }
  const json = (await res.json()) as { access_token?: string; refresh_token?: string };
  if (!json.access_token) throw new SharePointConnectorError("Microsoft did not return an access token.");
  return { accessToken: json.access_token, refreshToken: json.refresh_token ?? null };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await timedFetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireClientId(),
      client_secret: requireClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: SHAREPOINT_SCOPES.join(" "),
    }),
  });
  if (!res.ok) {
    throw new SharePointConnectorError(
      "The Microsoft connection has expired. Please reconnect the account.",
    );
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new SharePointConnectorError("Microsoft did not return an access token.");
  return json.access_token;
}

export async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await timedFetch(`${GRAPH}/me?$select=mail,userPrincipalName`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { mail?: string; userPrincipalName?: string };
    return json.mail || json.userPrincipalName || null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Sharing-link resolution + drive traversal (Microsoft Graph)               */
/* -------------------------------------------------------------------------- */

/** Encode a sharing URL into the `u!` share id Graph's /shares endpoint expects. */
export function encodeShareUrl(rawUrl: string): string {
  const b64 = Buffer.from(rawUrl.trim(), "utf8").toString("base64");
  return `u!${b64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-")}`;
}

export interface DriveItemRef {
  driveId: string;
  itemId: string;
}

interface GraphItem {
  id: string;
  name: string;
  size?: number;
  folder?: unknown;
  file?: unknown;
  parentReference?: { driveId?: string };
}

/** Resolve a OneDrive/SharePoint sharing link to a concrete drive item. */
export async function resolveShareLink(accessToken: string, shareUrl: string): Promise<DriveItemRef> {
  const shareId = encodeShareUrl(shareUrl);
  const res = await timedFetch(
    `${GRAPH}/shares/${shareId}/driveItem?$select=id,name,parentReference`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (res.status === 404) {
    throw new SharePointConnectorError("That link could not be opened (check sharing/access).");
  }
  if (!res.ok) throw new SharePointConnectorError("Could not open that SharePoint / OneDrive link.");
  const json = (await res.json()) as GraphItem;
  const driveId = json.parentReference?.driveId;
  if (!driveId || !json.id) {
    throw new SharePointConnectorError("That link doesn’t point to a file or folder we can read.");
  }
  return { driveId, itemId: json.id };
}

async function getItem(accessToken: string, ref: DriveItemRef): Promise<GraphItem> {
  const res = await timedFetch(
    `${GRAPH}/drives/${ref.driveId}/items/${ref.itemId}?$select=id,name,size,folder,file`,
    { headers: { authorization: `Bearer ${accessToken}` } },
  );
  if (res.status === 404) throw new SharePointConnectorError("That item was not found.");
  if (!res.ok) throw new SharePointConnectorError("Could not read that item.");
  return (await res.json()) as GraphItem;
}

async function listChildren(accessToken: string, ref: DriveItemRef): Promise<GraphItem[]> {
  const items: GraphItem[] = [];
  let url: string | undefined =
    `${GRAPH}/drives/${ref.driveId}/items/${ref.itemId}/children?$select=id,name,size,folder,file&$top=200`;
  while (url) {
    const res = await timedFetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new SharePointConnectorError("Could not list that folder.");
    const json = (await res.json()) as { value?: GraphItem[]; "@odata.nextLink"?: string };
    for (const it of json.value ?? []) {
      items.push(it);
      if (items.length >= MAX_FILES) return items;
    }
    url = json["@odata.nextLink"];
  }
  return items;
}

async function downloadItem(accessToken: string, ref: DriveItemRef): Promise<Uint8Array> {
  // The content endpoint 302-redirects to a pre-authed download URL; fetch follows.
  const res = await timedFetch(`${GRAPH}/drives/${ref.driveId}/items/${ref.itemId}/content`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new SharePointConnectorError("Could not download a file.");
  return new Uint8Array(await res.arrayBuffer());
}

export interface SharePointDocument {
  title: string;
  text: string | null;
  status: DocumentExtractionStatus;
}

export interface SharePointIngestResult {
  rootName: string;
  documents: SharePointDocument[];
  skipped: number;
}

/**
 * Read a resolved drive item (file or folder) into extracted-text documents. A
 * folder is read one level deep (bounded by MAX_FILES); a single file yields one
 * document. Unsupported/oversized files are skipped, not failed.
 */
export async function ingestDriveItem(input: {
  accessToken: string;
  ref: DriveItemRef;
}): Promise<SharePointIngestResult> {
  const root = await getItem(input.accessToken, input.ref);
  const targets = root.folder ? await listChildren(input.accessToken, input.ref) : [root];

  const documents: SharePointDocument[] = [];
  let skipped = 0;

  for (const item of targets) {
    if (documents.length >= MAX_FILES) break;
    if (item.folder) {
      skipped += 1; // nested folders aren't recursed in this version
      continue;
    }
    const ext = fileExtension(item.name);
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      skipped += 1;
      continue;
    }
    if (item.size !== undefined && item.size > MAX_FILE_BYTES) {
      documents.push({ title: item.name, text: null, status: "failed" });
      continue;
    }
    try {
      const bytes = await downloadItem(input.accessToken, {
        driveId: input.ref.driveId,
        itemId: item.id,
      });
      const extracted = await extractFileText(bytes, ext);
      documents.push({ title: item.name, text: extracted.text, status: extracted.status });
    } catch {
      documents.push({ title: item.name, text: null, status: "failed" });
    }
  }

  return { rootName: root.name, documents, skipped };
}
