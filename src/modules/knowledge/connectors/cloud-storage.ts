import "server-only";

/**
 * Cloud storage knowledge connector (Sprint 025).
 *
 * Connect an object store and turn its files into searchable Knowledge Vault
 * documents an AI Employee can answer from. Three providers:
 *   - **Azure Blob Storage** — via a read-only **container SAS URL** (the SAS is
 *     scoped by the customer to read+list, and time-boxed; nothing else is needed).
 *   - **Google Cloud Storage** — via a **service-account JSON key** with read
 *     access; we mint a short-lived access token (RS256 JWT, `devstorage.read_only`).
 *   - **Amazon S3** — via an **access key** (least-privilege, read-only); requests
 *     are signed with AWS Signature V4 (`node:crypto`), no AWS SDK dependency.
 *
 * Dependency-free: object listing/download use the providers' REST APIs over
 * `fetch`, and GCS auth is signed with `node:crypto`. Files run through the shared
 * extractor (PDF / DOCX / text), so this module only adds list + download in front
 * of the existing index → hybrid-retrieval pipeline.
 *
 * SAFETY:
 *  - Read-only by construction — Azure via a read/list SAS, GCS via the
 *    `devstorage.read_only` scope.
 *  - Azure fetches are restricted to `*.blob.core.windows.net` (the user supplies a
 *    URL, so the host is pinned to prevent SSRF). GCS hosts are constructed by us.
 *  - Bounded: capped file count and per-file size; unsupported types are skipped.
 *  - Credentials (SAS URL / service-account JSON) are stored encrypted at rest.
 */

import { createHmac, createHash } from "node:crypto";
import { extractFileText } from "@/modules/knowledge/extraction";
import { ALLOWED_EXTENSIONS, fileExtension } from "@/modules/knowledge/metadata";
import type { DocumentExtractionStatus } from "@/lib/db/types";

export type CloudStorageProvider = "azure_blob" | "gcs" | "s3";

const MAX_FILES = 50;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

const AZURE_HOST_SUFFIX = ".blob.core.windows.net";
const GCS_API = "https://storage.googleapis.com/storage/v1";
const GCS_SCOPE = "https://www.googleapis.com/auth/devstorage.read_only";

export class CloudStorageConnectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudStorageConnectorError";
  }
}

export interface CloudDocument {
  title: string;
  text: string | null;
  status: DocumentExtractionStatus;
}

export interface CloudIngestResult {
  /** Display name of the source (bucket or account/container). */
  rootName: string;
  documents: CloudDocument[];
  /** Files skipped because their type isn't supported. */
  skipped: number;
}

interface CloudObject {
  /** Full object/blob key. */
  name: string;
  size?: number;
}

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

const encoder = new TextEncoder();

function base64UrlFromBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlFromString(value: string): string {
  return base64UrlFromBytes(encoder.encode(value));
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

/** Keep only objects whose extension the shared extractor supports. */
export function filterSupported(objects: CloudObject[]): CloudObject[] {
  return objects.filter((o) => {
    if (o.name.endsWith("/")) return false; // "folder" placeholder
    const ext = fileExtension(o.name);
    return !!ext && ALLOWED_EXTENSIONS.includes(ext);
  });
}

/** Turn a downloaded object into an extracted-text document. */
async function toDocument(name: string, bytes: Uint8Array): Promise<CloudDocument> {
  const ext = fileExtension(name);
  const extracted = await extractFileText(bytes, ext);
  const title = name.split("/").filter(Boolean).pop() ?? name;
  return { title, text: extracted.text, status: extracted.status };
}

/* -------------------------------------------------------------------------- */
/* Azure Blob Storage (read-only container SAS URL)                           */
/* -------------------------------------------------------------------------- */

interface AzureContainer {
  /** Origin + `/container` path, no query. */
  base: string;
  /** SAS query string without the leading `?`. */
  sas: string;
  /** account/container, for display. */
  displayName: string;
}

/** Parse + validate a container SAS URL, pinning the host to Azure Blob. */
export function parseAzureContainerUrl(rawUrl: string): AzureContainer {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new CloudStorageConnectorError("Enter a valid Azure container SAS URL.");
  }
  if (url.protocol !== "https:" || !url.hostname.toLowerCase().endsWith(AZURE_HOST_SUFFIX)) {
    throw new CloudStorageConnectorError(
      "That doesn’t look like an Azure Blob URL (expected https://<account>.blob.core.windows.net/…).",
    );
  }
  if (!url.search || !url.searchParams.get("sig")) {
    throw new CloudStorageConnectorError("The Azure URL must include a SAS token (the `sig` part).");
  }
  const container = url.pathname.split("/").filter(Boolean)[0];
  if (!container) {
    throw new CloudStorageConnectorError("Include the container in the SAS URL (…/<container>?sv=…).");
  }
  const account = url.hostname.split(".")[0];
  return {
    base: `${url.origin}/${container}`,
    sas: url.search.slice(1),
    displayName: `${account}/${container}`,
  };
}

/** Parse an Azure "list blobs" XML response into objects + a continuation marker. */
export function parseAzureBlobList(xml: string): { objects: CloudObject[]; nextMarker: string | null } {
  const objects: CloudObject[] = [];
  for (const block of xml.matchAll(/<Blob>([\s\S]*?)<\/Blob>/g)) {
    const body = block[1];
    const name = body.match(/<Name>([\s\S]*?)<\/Name>/)?.[1];
    if (!name) continue;
    const sizeStr = body.match(/<Content-Length>(\d+)<\/Content-Length>/)?.[1];
    objects.push({ name: decodeXml(name), size: sizeStr ? Number(sizeStr) : undefined });
  }
  const nextMarker = xml.match(/<NextMarker>([\s\S]*?)<\/NextMarker>/)?.[1] || null;
  return { objects, nextMarker };
}

function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function azureListBlobs(container: AzureContainer, prefix: string): Promise<CloudObject[]> {
  const objects: CloudObject[] = [];
  let marker: string | null = null;
  do {
    // Append to the raw SAS string rather than re-parsing it — the `sig` value is
    // already percent-encoded and must not be re-encoded.
    let query = `${container.sas}&restype=container&comp=list`;
    if (prefix) query += `&prefix=${encodeURIComponent(prefix)}`;
    if (marker) query += `&marker=${encodeURIComponent(marker)}`;
    const res = await timedFetch(`${container.base}?${query}`);
    if (!res.ok) {
      throw new CloudStorageConnectorError(
        "Could not list the Azure container. Check the SAS URL has read + list permission and hasn’t expired.",
      );
    }
    const parsed = parseAzureBlobList(await res.text());
    objects.push(...parsed.objects);
    if (objects.length >= MAX_FILES) break;
    marker = parsed.nextMarker;
  } while (marker);
  return objects;
}

async function azureDownload(container: AzureContainer, name: string): Promise<Uint8Array> {
  const path = name.split("/").map(encodeURIComponent).join("/");
  const res = await timedFetch(`${container.base}/${path}?${container.sas}`);
  if (!res.ok) throw new CloudStorageConnectorError(`Could not download "${name}" from Azure.`);
  return new Uint8Array(await res.arrayBuffer());
}

/* -------------------------------------------------------------------------- */
/* Google Cloud Storage (service-account JSON)                                */
/* -------------------------------------------------------------------------- */

export interface GcsServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

/** Parse + validate a service-account JSON key. */
export function parseServiceAccount(rawJson: string): GcsServiceAccount {
  let parsed: Partial<GcsServiceAccount>;
  try {
    parsed = JSON.parse(rawJson) as Partial<GcsServiceAccount>;
  } catch {
    throw new CloudStorageConnectorError("The service-account key must be valid JSON.");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new CloudStorageConnectorError(
      "That service-account key is missing `client_email` or `private_key`.",
    );
  }
  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
    token_uri: parsed.token_uri || "https://oauth2.googleapis.com/token",
  };
}

function pemToPkcs8Der(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

/** Mint a short-lived GCS access token from a service account (2-legged JWT). */
export async function gcsAccessToken(sa: GcsServiceAccount, nowSeconds: number): Promise<string> {
  const header = base64UrlFromString(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64UrlFromString(
    JSON.stringify({
      iss: sa.client_email,
      scope: GCS_SCOPE,
      aud: sa.token_uri,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const signingInput = `${header}.${claim}`;
  let key: CryptoKey;
  try {
    key = await globalThis.crypto.subtle.importKey(
      "pkcs8",
      pemToPkcs8Der(sa.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    throw new CloudStorageConnectorError("The service-account private key could not be read.");
  }
  const sig = await globalThis.crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(signingInput),
  );
  const assertion = `${signingInput}.${base64UrlFromBytes(new Uint8Array(sig))}`;

  const res = await timedFetch(sa.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new CloudStorageConnectorError(
      "Google rejected the service-account key. Check it has read access to the bucket.",
    );
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new CloudStorageConnectorError("Google did not return an access token.");
  return json.access_token;
}

async function gcsListObjects(token: string, bucket: string, prefix: string): Promise<CloudObject[]> {
  const objects: CloudObject[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ maxResults: "100" });
    if (prefix) params.set("prefix", prefix);
    if (pageToken) params.set("pageToken", pageToken);
    const res = await timedFetch(`${GCS_API}/b/${encodeURIComponent(bucket)}/o?${params.toString()}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 404) throw new CloudStorageConnectorError("That bucket was not found.");
    if (!res.ok) throw new CloudStorageConnectorError("Could not list the Google Cloud Storage bucket.");
    const json = (await res.json()) as {
      items?: Array<{ name: string; size?: string }>;
      nextPageToken?: string;
    };
    for (const item of json.items ?? []) {
      objects.push({ name: item.name, size: item.size ? Number(item.size) : undefined });
      if (objects.length >= MAX_FILES) return objects;
    }
    pageToken = json.nextPageToken;
  } while (pageToken);
  return objects;
}

async function gcsDownload(token: string, bucket: string, name: string): Promise<Uint8Array> {
  const url = `${GCS_API}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?alt=media`;
  const res = await timedFetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new CloudStorageConnectorError(`Could not download "${name}" from the bucket.`);
  return new Uint8Array(await res.arrayBuffer());
}

/* -------------------------------------------------------------------------- */
/* Amazon S3 (AWS Signature V4)                                               */
/* -------------------------------------------------------------------------- */

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  /** Optional session token for temporary credentials. */
  sessionToken?: string;
}

/** Validate S3 credentials/target; region + bucket must be safe for the host. */
export function assertS3Credentials(cred: S3Credentials): S3Credentials {
  if (!cred.accessKeyId || !cred.secretAccessKey) {
    throw new CloudStorageConnectorError("Enter the AWS access key ID and secret access key.");
  }
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(cred.bucket)) {
    throw new CloudStorageConnectorError("Enter a valid S3 bucket name.");
  }
  if (!/^[a-z0-9-]{1,32}$/.test(cred.region)) {
    throw new CloudStorageConnectorError("Enter a valid AWS region (e.g. us-east-1).");
  }
  return cred;
}

/** RFC 3986 encoding as required by SigV4 (encodeURIComponent + the extra chars). */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Encode an object key for the canonical URI, preserving `/` separators. */
function encodeS3Key(key: string): string {
  return key.split("/").map(encodeRfc3986).join("/");
}

/** `YYYYMMDDTHHMMSSZ` + `YYYYMMDD` from unix seconds (deterministic, testable). */
function amzDate(nowSeconds: number): { amzDate: string; dateStamp: string } {
  const iso = new Date(nowSeconds * 1000).toISOString();
  const stamp = iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return { amzDate: stamp, dateStamp: stamp.slice(0, 8) };
}

/**
 * The AWS SigV4 signing-key chain + final signature. Exported so it can be tested
 * against AWS's published test vector (non-circular verification of the crypto).
 */
export function sigV4Signature(input: {
  secretAccessKey: string;
  dateStamp: string;
  region: string;
  service: string;
  stringToSign: string;
}): string {
  const kDate = createHmac("sha256", `AWS4${input.secretAccessKey}`).update(input.dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(input.region).digest();
  const kService = createHmac("sha256", kRegion).update(input.service).digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  return createHmac("sha256", kSigning).update(input.stringToSign, "utf8").digest("hex");
}

/** Build the SigV4 Authorization + amz headers for a GET (empty-payload) request. */
function signS3Get(input: {
  host: string;
  canonicalUri: string;
  canonicalQuery: string;
  cred: S3Credentials;
  nowSeconds: number;
}): Record<string, string> {
  const { amzDate: date, dateStamp } = amzDate(input.nowSeconds);
  const payloadHash = createHash("sha256").update("").digest("hex");

  let canonicalHeaders =
    `host:${input.host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${date}\n`;
  let signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  // x-amz-security-token sorts after x-amz-date, so it is appended last.
  if (input.cred.sessionToken) {
    canonicalHeaders += `x-amz-security-token:${input.cred.sessionToken}\n`;
    signedHeaders += ";x-amz-security-token";
  }

  const canonicalRequest = [
    "GET",
    input.canonicalUri,
    input.canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${input.cred.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    date,
    scope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  const signature = sigV4Signature({
    secretAccessKey: input.cred.secretAccessKey,
    dateStamp,
    region: input.cred.region,
    service: "s3",
    stringToSign,
  });

  const headers: Record<string, string> = {
    authorization:
      `AWS4-HMAC-SHA256 Credential=${input.cred.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": date,
  };
  if (input.cred.sessionToken) headers["x-amz-security-token"] = input.cred.sessionToken;
  return headers;
}

/** Parse a ListObjectsV2 XML response into objects + a continuation token. */
export function parseS3List(xml: string): { objects: CloudObject[]; nextToken: string | null } {
  const objects: CloudObject[] = [];
  for (const block of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const body = block[1];
    const key = body.match(/<Key>([\s\S]*?)<\/Key>/)?.[1];
    if (!key) continue;
    const sizeStr = body.match(/<Size>(\d+)<\/Size>/)?.[1];
    objects.push({ name: decodeXml(key), size: sizeStr ? Number(sizeStr) : undefined });
  }
  const truncated = xml.match(/<IsTruncated>(true|false)<\/IsTruncated>/)?.[1] === "true";
  const token = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? null;
  return { objects, nextToken: truncated ? token : null };
}

function s3Host(cred: S3Credentials): string {
  return `${cred.bucket}.s3.${cred.region}.amazonaws.com`;
}

function canonicalQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(params[k])}`)
    .join("&");
}

async function s3ListObjects(
  cred: S3Credentials,
  prefix: string,
  nowSeconds: number,
): Promise<CloudObject[]> {
  const host = s3Host(cred);
  const objects: CloudObject[] = [];
  let token: string | null = null;
  do {
    const params: Record<string, string> = { "list-type": "2", "max-keys": "1000" };
    if (prefix) params.prefix = prefix;
    if (token) params["continuation-token"] = token;
    const query = canonicalQuery(params);
    const headers = signS3Get({ host, canonicalUri: "/", canonicalQuery: query, cred, nowSeconds });
    const res = await timedFetch(`https://${host}/?${query}`, { headers });
    if (res.status === 403) {
      throw new CloudStorageConnectorError(
        "Access denied by S3. Check the key has read + list permission on the bucket.",
      );
    }
    if (res.status === 404) throw new CloudStorageConnectorError("That S3 bucket was not found.");
    if (!res.ok) throw new CloudStorageConnectorError("Could not list the S3 bucket.");
    const parsed = parseS3List(await res.text());
    objects.push(...parsed.objects);
    if (objects.length >= MAX_FILES) break;
    token = parsed.nextToken;
  } while (token);
  return objects;
}

async function s3Download(cred: S3Credentials, key: string, nowSeconds: number): Promise<Uint8Array> {
  const host = s3Host(cred);
  const canonicalUri = `/${encodeS3Key(key)}`;
  const headers = signS3Get({ host, canonicalUri, canonicalQuery: "", cred, nowSeconds });
  const res = await timedFetch(`https://${host}${canonicalUri}`, { headers });
  if (!res.ok) throw new CloudStorageConnectorError(`Could not download "${key}" from S3.`);
  return new Uint8Array(await res.arrayBuffer());
}

/* -------------------------------------------------------------------------- */
/* Unified ingestion                                                          */
/* -------------------------------------------------------------------------- */

export interface CloudStorageInput {
  provider: CloudStorageProvider;
  prefix?: string;
  /** Azure: read/list container SAS URL. */
  azureSasUrl?: string;
  /** GCS: bucket name. */
  gcsBucket?: string;
  /** GCS: service-account JSON key. */
  gcsServiceAccount?: string;
  /** S3: access key + region + bucket (+ optional session token). */
  s3?: S3Credentials;
  /** Unix seconds — passed in so the pure module never calls Date.now() itself. */
  nowSeconds: number;
}

/**
 * List a bucket/container, download supported files, and extract their text.
 * Bounded by MAX_FILES; oversized/unsupported files are skipped, not failed.
 */
export async function ingestCloudStorage(input: CloudStorageInput): Promise<CloudIngestResult> {
  const prefix = input.prefix?.trim() ?? "";

  let rootName: string;
  let listed: CloudObject[];
  let download: (name: string) => Promise<Uint8Array>;

  if (input.provider === "azure_blob") {
    if (!input.azureSasUrl) throw new CloudStorageConnectorError("Enter the Azure container SAS URL.");
    const container = parseAzureContainerUrl(input.azureSasUrl);
    rootName = container.displayName;
    listed = await azureListBlobs(container, prefix);
    download = (name) => azureDownload(container, name);
  } else if (input.provider === "s3") {
    if (!input.s3) throw new CloudStorageConnectorError("Enter the S3 access key, region, and bucket.");
    const cred = assertS3Credentials(input.s3);
    rootName = cred.bucket;
    listed = await s3ListObjects(cred, prefix, input.nowSeconds);
    download = (name) => s3Download(cred, name, input.nowSeconds);
  } else {
    if (!input.gcsBucket) throw new CloudStorageConnectorError("Enter the bucket name.");
    if (!input.gcsServiceAccount) throw new CloudStorageConnectorError("Paste the service-account JSON key.");
    const sa = parseServiceAccount(input.gcsServiceAccount);
    const token = await gcsAccessToken(sa, input.nowSeconds);
    rootName = input.gcsBucket;
    listed = await gcsListObjects(token, input.gcsBucket, prefix);
    download = (name) => gcsDownload(token, input.gcsBucket as string, name);
  }

  const supported = filterSupported(listed);
  // Everything listed but of an unsupported type is reported as skipped.
  let skipped = listed.length - supported.length;

  const documents: CloudDocument[] = [];
  for (const obj of supported) {
    if (documents.length >= MAX_FILES) break;
    if (obj.size !== undefined && obj.size > MAX_FILE_BYTES) {
      skipped += 1;
      continue;
    }
    try {
      const bytes = await download(obj.name);
      documents.push(await toDocument(obj.name, bytes));
    } catch {
      documents.push({ title: obj.name, text: null, status: "failed" });
    }
  }

  return { rootName, documents, skipped };
}
