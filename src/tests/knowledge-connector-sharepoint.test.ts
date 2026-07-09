// @vitest-environment node
// The SharePoint connector uses node crypto + fetch (server runtime), so it runs
// in the node environment, not a browser DOM.
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

beforeAll(() => {
  process.env.AUTH_SECRET = "test-auth-secret-abcdefghijklmnop";
  process.env.TAURUS_MODEL_CREDENTIALS_MASTER_KEY = "test-master-key-abcdefghijklmnop";
  process.env.MICROSOFT_CLIENT_ID = "test-client-id";
  process.env.MICROSOFT_CLIENT_SECRET = "test-client-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

import {
  signState,
  verifyState,
  encodePendingConnection,
  decodePendingConnection,
  buildConsentUrl,
  encodeShareUrl,
  isSharePointConfigured,
  resolveShareLink,
  ingestDriveItem,
} from "@/modules/knowledge/connectors/sharepoint";

describe("sharepoint connector — OAuth state", () => {
  it("round-trips a signed state and rejects tampering + expiry", async () => {
    const token = await signState({ uid: "u1", orgId: "o1", nonce: "n", iat: Date.now() });
    const decoded = await verifyState(token);
    expect(decoded?.uid).toBe("u1");
    expect(await verifyState(`${token}x`)).toBeNull();
    expect(await verifyState(undefined)).toBeNull();
    const stale = await signState({ uid: "u1", orgId: "o1", nonce: "n", iat: Date.now() - 60 * 60 * 1000 });
    expect(await verifyState(stale)).toBeNull();
  });
});

describe("sharepoint connector — pending cookie + config", () => {
  it("encrypts and round-trips the refresh token", async () => {
    const value = await encodePendingConnection({ refreshToken: "rt-secret", email: "a@b.com" });
    expect(value).not.toContain("rt-secret");
    expect(await decodePendingConnection(value)).toEqual({ refreshToken: "rt-secret", email: "a@b.com" });
    expect(await decodePendingConnection(undefined)).toBeNull();
  });

  it("reports configured and builds a Microsoft consent url with read-only scopes", () => {
    expect(isSharePointConfigured()).toBe(true);
    const url = buildConsentUrl({ state: "st", redirectUri: "https://app.example.com/cb" });
    expect(url).toContain("login.microsoftonline.com");
    expect(decodeURIComponent(url)).toContain("Files.Read.All");
    expect(decodeURIComponent(url)).toContain("offline_access");
    expect(url).toContain("state=st");
  });

  it("encodes a sharing url into a Graph share id (base64url, u! prefix)", () => {
    const id = encodeShareUrl("https://contoso.sharepoint.com/:f:/s/team/AbC+d/e=");
    expect(id.startsWith("u!")).toBe(true);
    expect(id.slice(2)).not.toMatch(/[+/=]/); // base64url only
  });
});

describe("sharepoint connector — resolve + ingest (mocked Graph)", () => {
  it("resolves a share link to a drive item", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ id: "ROOT", name: "Team Docs", parentReference: { driveId: "D1" } }),
          { status: 200 },
        ),
      ),
    );
    const ref = await resolveShareLink("token", "https://contoso.sharepoint.com/:f:/s/team/xyz");
    expect(ref).toEqual({ driveId: "D1", itemId: "ROOT" });
  });

  it("reads a folder one level deep, extracting supported files only", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        if (u.includes("/items/ROOT/children")) {
          return new Response(
            JSON.stringify({
              value: [
                { id: "F1", name: "notes.txt", size: 16, file: {} },
                { id: "F2", name: "photo.png", size: 10, file: {} },
                { id: "F3", name: "Subfolder", folder: {} },
              ],
            }),
            { status: 200 },
          );
        }
        if (u.includes("/items/ROOT?")) {
          return new Response(JSON.stringify({ id: "ROOT", name: "Team Docs", folder: {} }), {
            status: 200,
          });
        }
        if (u.includes("/items/F1/content")) {
          return new Response("hello from sharepoint", { status: 200 });
        }
        return new Response("", { status: 404 });
      }),
    );

    const res = await ingestDriveItem({ accessToken: "t", ref: { driveId: "D1", itemId: "ROOT" } });
    expect(res.rootName).toBe("Team Docs");
    expect(res.documents).toHaveLength(1); // .png + subfolder skipped
    expect(res.documents[0].title).toBe("notes.txt");
    expect(res.documents[0].text).toContain("hello from sharepoint");
    expect(res.skipped).toBe(2);
  });
});
