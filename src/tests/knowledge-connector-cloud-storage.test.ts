// @vitest-environment node
// The cloud-storage connector uses node crypto + fetch (server runtime), so it
// runs in the node environment, not a browser DOM.
import { describe, it, expect, vi, afterEach } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";

vi.mock("server-only", () => ({}));

import {
  parseAzureContainerUrl,
  parseAzureBlobList,
  parseServiceAccount,
  filterSupported,
  gcsAccessToken,
  ingestCloudStorage,
  CloudStorageConnectorError,
} from "@/modules/knowledge/connectors/cloud-storage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cloud storage — Azure SAS URL parsing", () => {
  it("splits a valid container SAS URL and pins the host", () => {
    const c = parseAzureContainerUrl(
      "https://myacct.blob.core.windows.net/docs?sv=2022&sig=abc123",
    );
    expect(c.base).toBe("https://myacct.blob.core.windows.net/docs");
    expect(c.sas).toContain("sig=abc123");
    expect(c.displayName).toBe("myacct/docs");
  });

  it("rejects non-Azure hosts, http, missing SAS, and missing container", () => {
    expect(() => parseAzureContainerUrl("https://evil.example.com/docs?sig=x")).toThrow(
      CloudStorageConnectorError,
    );
    expect(() => parseAzureContainerUrl("http://myacct.blob.core.windows.net/docs?sig=x")).toThrow();
    expect(() => parseAzureContainerUrl("https://myacct.blob.core.windows.net/docs")).toThrow(/SAS/);
    expect(() => parseAzureContainerUrl("https://myacct.blob.core.windows.net/?sv=1&sig=x")).toThrow(
      /container/,
    );
  });
});

describe("cloud storage — Azure blob list parsing + type filter", () => {
  const xml = `<?xml version="1.0"?><EnumerationResults><Blobs>
    <Blob><Name>reports/a.pdf</Name><Properties><Content-Length>1200</Content-Length></Properties></Blob>
    <Blob><Name>logo.png</Name><Properties><Content-Length>50</Content-Length></Properties></Blob>
    <Blob><Name>notes.txt</Name><Properties><Content-Length>10</Content-Length></Properties></Blob>
  </Blobs><NextMarker>MARK2</NextMarker></EnumerationResults>`;

  it("parses blob names, sizes, and the continuation marker", () => {
    const { objects, nextMarker } = parseAzureBlobList(xml);
    expect(objects.map((o) => o.name)).toEqual(["reports/a.pdf", "logo.png", "notes.txt"]);
    expect(objects[0].size).toBe(1200);
    expect(nextMarker).toBe("MARK2");
  });

  it("keeps only extractor-supported types", () => {
    const { objects } = parseAzureBlobList(xml);
    const kept = filterSupported(objects).map((o) => o.name);
    expect(kept).toEqual(["reports/a.pdf", "notes.txt"]); // .png dropped
  });
});

describe("cloud storage — GCS service account parsing", () => {
  it("accepts a valid key and defaults token_uri", () => {
    const sa = parseServiceAccount(
      JSON.stringify({ client_email: "svc@p.iam.gserviceaccount.com", private_key: "KEY" }),
    );
    expect(sa.client_email).toBe("svc@p.iam.gserviceaccount.com");
    expect(sa.token_uri).toBe("https://oauth2.googleapis.com/token");
  });

  it("rejects invalid JSON and missing fields", () => {
    expect(() => parseServiceAccount("not json")).toThrow(CloudStorageConnectorError);
    expect(() => parseServiceAccount(JSON.stringify({ client_email: "x" }))).toThrow(/private_key/);
  });
});

describe("cloud storage — GCS access token (RS256 JWT)", () => {
  it("signs a verifiable JWT and exchanges it for a token", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    const sa = {
      client_email: "svc@proj.iam.gserviceaccount.com",
      private_key: pem,
      token_uri: "https://oauth2.test/token",
    };

    let capturedAssertion = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = new URLSearchParams(String(init?.body));
        capturedAssertion = body.get("assertion") ?? "";
        return new Response(JSON.stringify({ access_token: "tok-123" }), { status: 200 });
      }),
    );

    const token = await gcsAccessToken(sa, 1_700_000_000);
    expect(token).toBe("tok-123");

    // The assertion must be a real RS256 JWT our key signed, with the right claims.
    const [h, c, s] = capturedAssertion.split(".");
    const verify = createVerify("RSA-SHA256");
    verify.update(`${h}.${c}`);
    verify.end();
    const sig = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    expect(verify.verify(publicKey, sig)).toBe(true);
    const claim = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claim.iss).toBe(sa.client_email);
    expect(claim.scope).toContain("devstorage.read_only");
    expect(claim.aud).toBe(sa.token_uri);
    expect(claim.exp - claim.iat).toBe(3600);
  });
});

describe("cloud storage — Azure ingest (mocked fetch)", () => {
  it("lists a container, downloads supported files, and extracts text", async () => {
    const xml = `<EnumerationResults><Blobs>
      <Blob><Name>notes.txt</Name><Properties><Content-Length>23</Content-Length></Properties></Blob>
      <Blob><Name>logo.png</Name><Properties><Content-Length>50</Content-Length></Properties></Blob>
    </Blobs></EnumerationResults>`;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("comp=list")) return new Response(xml, { status: 200 });
        if (u.includes("/notes.txt")) return new Response("hello world from azure", { status: 200 });
        return new Response("", { status: 404 });
      }),
    );

    const res = await ingestCloudStorage({
      provider: "azure_blob",
      azureSasUrl: "https://acct.blob.core.windows.net/container?sv=x&sig=y",
      nowSeconds: 1_700_000_000,
    });
    expect(res.rootName).toBe("acct/container");
    expect(res.documents).toHaveLength(1); // .png filtered out
    expect(res.documents[0].title).toBe("notes.txt");
    expect(res.documents[0].text).toContain("hello world");
    expect(res.skipped).toBe(1); // the .png
  });
});
