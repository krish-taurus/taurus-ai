import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  deriveSigningKey,
  isS3Configured,
  readS3Config,
  signS3Request,
  S3KnowledgeStorage,
  type S3Config,
} from "@/modules/knowledge/storage-s3";
import { getKnowledgeStorage, localKnowledgeStorage } from "@/modules/knowledge/storage";

afterEach(() => {
  vi.unstubAllGlobals();
});

const CONFIG: S3Config = {
  bucket: "taurus-uploads",
  region: "us-east-1",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRFiCYEXAMPLEKEY",
};

// Independent restatement of the SigV4 signing-key chain (from the spec) so the
// exported helper is checked against a reference, not just itself.
function referenceSigningKey(secret: string, date: string, region: string, service: string): Buffer {
  const h = (k: Buffer | string, d: string) => createHmac("sha256", k).update(d, "utf8").digest();
  return h(h(h(h(`AWS4${secret}`, date), region), service), "aws4_request");
}

describe("AWS Signature V4 signing", () => {
  it("derives the signing key matching an independent reference chain", () => {
    for (const [secret, date, region, service] of [
      ["wJalrXUtnFEMI/K7MDENG/bPxRFiCYEXAMPLEKEY", "20120215", "us-east-1", "iam"],
      ["another-secret", "20260101", "eu-west-1", "s3"],
    ] as const) {
      expect(deriveSigningKey(secret, date, region, service).toString("hex")).toBe(
        referenceSigningKey(secret, date, region, service).toString("hex"),
      );
    }
  });

  it("produces a stable end-to-end signature (self-consistent)", () => {
    // Same inputs must always yield the same signature — guards accidental
    // changes to the canonicalization or signing chain.
    const first = signS3Request({
      config: CONFIG,
      method: "PUT",
      key: "org-1/file.pdf",
      payloadHash: "abc123",
      amzDate: "20150830T123600Z",
    });
    const again = signS3Request({
      config: CONFIG,
      method: "PUT",
      key: "org-1/file.pdf",
      payloadHash: "abc123",
      amzDate: "20150830T123600Z",
    });
    expect(first.headers.authorization).toBe(again.headers.authorization);
    // A different payload must change the signature (payload hash is signed).
    const other = signS3Request({
      config: CONFIG,
      method: "PUT",
      key: "org-1/file.pdf",
      payloadHash: "def456",
      amzDate: "20150830T123600Z",
    });
    expect(other.headers.authorization).not.toBe(first.headers.authorization);
  });

  it("signs a virtual-hosted PUT with a deterministic authorization header", () => {
    const signed = signS3Request({
      config: CONFIG,
      method: "PUT",
      key: "org-1/file.pdf",
      payloadHash: "abc123",
      amzDate: "20150830T123600Z",
    });
    expect(signed.url).toBe("https://taurus-uploads.s3.us-east-1.amazonaws.com/org-1/file.pdf");
    expect(signed.headers.host).toBe("taurus-uploads.s3.us-east-1.amazonaws.com");
    expect(signed.headers["x-amz-content-sha256"]).toBe("abc123");
    expect(signed.headers.authorization).toContain(
      "Credential=AKIDEXAMPLE/20150830/us-east-1/s3/aws4_request",
    );
    expect(signed.headers.authorization).toContain(
      "SignedHeaders=host;x-amz-content-sha256;x-amz-date",
    );
    expect(signed.headers.authorization).toMatch(/Signature=[0-9a-f]{64}$/);
  });

  it("supports path-style and custom endpoints, and signs the session token", () => {
    const pathStyle = signS3Request({
      config: { ...CONFIG, forcePathStyle: true },
      method: "GET",
      key: "org-1/file.pdf",
      payloadHash: "x",
      amzDate: "20150830T123600Z",
    });
    expect(pathStyle.url).toBe(
      "https://s3.us-east-1.amazonaws.com/taurus-uploads/org-1/file.pdf",
    );

    const endpoint = signS3Request({
      config: {
        ...CONFIG,
        endpoint: "minio.internal:9000".replace(":9000", ""), // host only
        forcePathStyle: true,
        sessionToken: "SESSION==",
      },
      method: "GET",
      key: "org-1/file.pdf",
      payloadHash: "x",
      amzDate: "20150830T123600Z",
    });
    expect(endpoint.headers["x-amz-security-token"]).toBe("SESSION==");
    expect(endpoint.headers.authorization).toContain(
      "SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-security-token",
    );
  });
});

describe("readS3Config / isS3Configured", () => {
  it("is null/false without a bucket + credentials", () => {
    expect(readS3Config({})).toBeNull();
    expect(isS3Configured({ TAURUS_S3_BUCKET: "b" })).toBe(false);
  });

  it("reads a full config, defaulting the region", () => {
    const cfg = readS3Config({
      TAURUS_S3_BUCKET: "b",
      AWS_ACCESS_KEY_ID: "k",
      AWS_SECRET_ACCESS_KEY: "s",
    });
    expect(cfg).toEqual({
      bucket: "b",
      region: "us-east-1",
      accessKeyId: "k",
      secretAccessKey: "s",
      sessionToken: undefined,
      endpoint: undefined,
      forcePathStyle: false,
      prefix: undefined,
    });
  });
});

describe("S3KnowledgeStorage", () => {
  it("PUTs the exact bytes to the object key and rejects traversal", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const storage = new S3KnowledgeStorage({ ...CONFIG, prefix: "uploads" });
    const bytes = new Uint8Array([1, 2, 3, 4]);

    await storage.save({ organizationId: "org-9", storageKey: "abc.pdf", bytes });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://taurus-uploads.s3.us-east-1.amazonaws.com/uploads/org-9/abc.pdf",
    );
    expect(init.method).toBe("PUT");
    expect(Buffer.from(init.body as Buffer)).toEqual(Buffer.from(bytes));

    await expect(
      storage.save({ organizationId: "org-9", storageKey: "../evil", bytes }),
    ).rejects.toThrow(/Invalid storage key/);
  });

  it("throws with the status when S3 rejects a read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("denied", { status: 403 })),
    );
    const storage = new S3KnowledgeStorage(CONFIG);
    await expect(storage.read("org-9", "abc.pdf")).rejects.toThrow(/403/);
  });
});

describe("getKnowledgeStorage selector", () => {
  it("returns local storage when S3 is not configured", () => {
    const prev = { ...process.env };
    delete process.env.TAURUS_S3_BUCKET;
    try {
      expect(getKnowledgeStorage()).toBe(localKnowledgeStorage);
    } finally {
      process.env = prev;
    }
  });

  it("returns the S3 adapter when configured", () => {
    const prev = { ...process.env };
    process.env.TAURUS_S3_BUCKET = "b";
    process.env.AWS_ACCESS_KEY_ID = "k";
    process.env.AWS_SECRET_ACCESS_KEY = "s";
    try {
      expect(getKnowledgeStorage()).toBeInstanceOf(S3KnowledgeStorage);
    } finally {
      process.env = prev;
    }
  });
});
