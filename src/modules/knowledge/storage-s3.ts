/**
 * Knowledge Vault object-storage (S3) adapter (Sprint 046) — SERVER ONLY.
 *
 * The default upload storage writes to local disk, which is ephemeral on
 * serverless/containers — files vanish on redeploy. This adapter persists
 * uploaded bytes to Amazon S3 (or any S3-compatible endpoint: Cloudflare R2,
 * MinIO, GCS's S3 interop) so uploads survive restarts and scale horizontally.
 *
 * Dependency-free: requests are signed with AWS Signature V4 using node:crypto —
 * no aws-sdk. Objects are private (never public-read); they are read back through
 * the same authenticated, org-scoped server route as local storage. The signing
 * helpers are pure and unit-tested against AWS's published example vector.
 */

import { createHash, createHmac } from "node:crypto";
import type { KnowledgeStorage } from "@/modules/knowledge/service";

// --- Configuration -----------------------------------------------------------

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  /** Custom endpoint host for S3-compatible providers (no scheme), e.g. R2/MinIO. */
  endpoint?: string;
  /** Use path-style URLs (bucket in the path) — required by most MinIO setups. */
  forcePathStyle?: boolean;
  /** Optional key prefix, so many apps can share one bucket. */
  prefix?: string;
}

type EnvLike = Record<string, string | undefined>;

/** Read the S3 configuration from the environment, or null if not enabled. */
export function readS3Config(env: EnvLike = process.env): S3Config | null {
  const bucket = env.TAURUS_S3_BUCKET?.trim();
  const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    bucket,
    region: env.AWS_REGION?.trim() || "us-east-1",
    accessKeyId,
    secretAccessKey,
    sessionToken: env.AWS_SESSION_TOKEN?.trim() || undefined,
    endpoint: env.TAURUS_S3_ENDPOINT?.trim() || undefined,
    forcePathStyle: env.TAURUS_S3_FORCE_PATH_STYLE === "true",
    prefix: env.TAURUS_S3_PREFIX?.trim() || undefined,
  };
}

/** Whether object storage is fully configured (bucket + credentials present). */
export function isS3Configured(env: EnvLike = process.env): boolean {
  return readS3Config(env) !== null;
}

// --- AWS Signature V4 (pure helpers) -----------------------------------------

function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

/** Derive the SigV4 signing key (kSigning) for a date/region/service. */
export function deriveSigningKey(
  secretAccessKey: string,
  date: string, // YYYYMMDD
  region: string,
  service: string,
): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/** Encode a URI path per RFC 3986, preserving "/" between segments. */
function encodePath(path: string): string {
  return path
    .split("/")
    .map((seg) =>
      encodeURIComponent(seg).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`),
    )
    .join("/");
}

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

/**
 * Build a signed request (URL + headers) for an S3 object operation. `amzDate`
 * is injected so the result is deterministic and testable; callers pass the
 * current time. The payload hash covers the exact bytes being PUT (empty-string
 * hash for GET).
 */
export function signS3Request(params: {
  config: S3Config;
  method: "GET" | "PUT";
  key: string;
  payloadHash: string;
  amzDate: string; // e.g. 20150830T123600Z
}): SignedRequest {
  const { config, method, key, payloadHash, amzDate } = params;
  const date = amzDate.slice(0, 8);
  const service = "s3";

  // Resolve host + canonical path for virtual-hosted vs path-style vs custom.
  let host: string;
  let canonicalPath: string;
  if (config.endpoint) {
    host = config.endpoint;
    canonicalPath = config.forcePathStyle ? `/${config.bucket}/${key}` : `/${key}`;
  } else if (config.forcePathStyle) {
    host = `s3.${config.region}.amazonaws.com`;
    canonicalPath = `/${config.bucket}/${key}`;
  } else {
    host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
    canonicalPath = `/${key}`;
  }
  const encodedPath = encodePath(canonicalPath);

  // Canonical + signed headers (sorted, lowercase). Host, content sha, date, and
  // the optional session token are all signed.
  const headerMap: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (config.sessionToken) headerMap["x-amz-security-token"] = config.sessionToken;
  const signedHeaderNames = Object.keys(headerMap).sort();
  const canonicalHeaders = signedHeaderNames.map((n) => `${n}:${headerMap[n]}\n`).join("");
  const signedHeaders = signedHeaderNames.join(";");

  const canonicalRequest = [
    method,
    encodedPath,
    "", // no query string
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${date}/${config.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = deriveSigningKey(config.secretAccessKey, date, config.region, service);
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    url: `https://${host}${encodedPath}`,
    headers: { ...headerMap, authorization },
  };
}

// --- Storage adapter ---------------------------------------------------------

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/** Current UTC time as an AWS `amzDate` (YYYYMMDDTHHMMSSZ). */
function nowAmzDate(): string {
  return new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
}

/**
 * S3-backed KnowledgeStorage. Same key scheme as local storage
 * (<organizationId>/<storageKey>, optionally under a configured prefix), so a
 * migration between backends only moves bytes, not keys.
 */
export class S3KnowledgeStorage implements KnowledgeStorage {
  constructor(private readonly config: S3Config) {}

  private objectKey(organizationId: string, storageKey: string): string {
    if (storageKey.includes("/") || storageKey.includes("\\") || storageKey.includes("..")) {
      throw new Error("Invalid storage key.");
    }
    const base = `${organizationId}/${storageKey}`;
    const prefix = this.config.prefix?.replace(/^\/+|\/+$/g, "");
    return prefix ? `${prefix}/${base}` : base;
  }

  async save(input: {
    organizationId: string;
    storageKey: string;
    bytes: Uint8Array;
  }): Promise<void> {
    const key = this.objectKey(input.organizationId, input.storageKey);
    const body = Buffer.from(input.bytes);
    const signed = signS3Request({
      config: this.config,
      method: "PUT",
      key,
      payloadHash: sha256Hex(body),
      amzDate: nowAmzDate(),
    });
    const res = await fetch(signed.url, { method: "PUT", headers: signed.headers, body });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`S3 upload failed (${res.status}): ${detail.slice(0, 200)}`);
    }
  }

  async read(organizationId: string, storageKey: string): Promise<Uint8Array> {
    const key = this.objectKey(organizationId, storageKey);
    const signed = signS3Request({
      config: this.config,
      method: "GET",
      key,
      payloadHash: EMPTY_SHA256,
      amzDate: nowAmzDate(),
    });
    const res = await fetch(signed.url, { method: "GET", headers: signed.headers });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`S3 download failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }
}
