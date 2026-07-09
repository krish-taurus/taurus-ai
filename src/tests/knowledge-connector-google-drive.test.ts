// @vitest-environment node
// The Google Drive connector uses node crypto + fetch (server runtime), so it
// runs in the node environment, not a browser DOM.
import { describe, it, expect, beforeAll, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Secrets the connector reads at call time (state signing + token encryption).
beforeAll(() => {
  process.env.AUTH_SECRET = "test-auth-secret-abcdefghijklmnop";
  process.env.TAURUS_MODEL_CREDENTIALS_MASTER_KEY = "test-master-key-abcdefghijklmnop";
  process.env.GOOGLE_DRIVE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
  process.env.GOOGLE_DRIVE_CLIENT_SECRET = "test-client-secret";
});

import {
  parseDriveId,
  planForMime,
  signState,
  verifyState,
  encodePendingConnection,
  decodePendingConnection,
  buildConsentUrl,
  isGoogleDriveConfigured,
} from "@/modules/knowledge/connectors/google-drive";

describe("google drive connector — link parsing", () => {
  it("extracts the id from folder, file, docs links and raw ids", () => {
    expect(parseDriveId("https://drive.google.com/drive/folders/1AbC_def-123")).toBe("1AbC_def-123");
    expect(parseDriveId("https://drive.google.com/file/d/1XyZ987/view?usp=sharing")).toBe("1XyZ987");
    expect(parseDriveId("https://docs.google.com/document/d/1DocId42/edit")).toBe("1DocId42");
    expect(parseDriveId("https://drive.google.com/open?id=1OpenId9")).toBe("1OpenId9");
    expect(parseDriveId("1RawIdValue_20chars")).toBe("1RawIdValue_20chars");
  });

  it("rejects non-Drive and malformed links", () => {
    expect(parseDriveId("https://evil.example.com/drive/folders/1abc")).toBeNull();
    expect(parseDriveId("not a link")).toBeNull();
    expect(parseDriveId("")).toBeNull();
  });
});

describe("google drive connector — mime planning", () => {
  it("exports Google-native docs and downloads real files", () => {
    expect(planForMime("application/vnd.google-apps.document", "Doc")?.mode).toBe("export");
    expect(planForMime("application/vnd.google-apps.spreadsheet", "Sheet")?.exportMime).toBe("text/csv");
    expect(planForMime("application/pdf", "a.pdf")?.mode).toBe("download");
    expect(planForMime("text/plain", "notes.txt")?.extension).toBe(".txt");
  });

  it("falls back to a supported file extension for unknown mime, else skips", () => {
    expect(planForMime("application/octet-stream", "data.csv")?.extension).toBe(".csv");
    expect(planForMime("application/vnd.google-apps.folder", "folder")).toBeNull();
    expect(planForMime("image/png", "photo.png")).toBeNull();
  });
});

describe("google drive connector — OAuth state", () => {
  it("round-trips a signed state and rejects tampering", async () => {
    const token = await signState({ uid: "u1", orgId: "o1", nonce: "n", iat: Date.now() });
    const decoded = await verifyState(token);
    expect(decoded?.uid).toBe("u1");
    expect(decoded?.orgId).toBe("o1");
    // Tamper with the signature.
    expect(await verifyState(`${token}x`)).toBeNull();
    expect(await verifyState("garbage")).toBeNull();
    expect(await verifyState(undefined)).toBeNull();
  });

  it("rejects an expired state", async () => {
    const stale = await signState({ uid: "u1", orgId: "o1", nonce: "n", iat: Date.now() - 60 * 60 * 1000 });
    expect(await verifyState(stale)).toBeNull();
  });
});

describe("google drive connector — pending connection cookie", () => {
  it("encrypts and round-trips a refresh token", async () => {
    const value = await encodePendingConnection({ refreshToken: "rt-secret", email: "a@b.com" });
    // The plaintext token must never appear in the cookie value.
    expect(value).not.toContain("rt-secret");
    const decoded = await decodePendingConnection(value);
    expect(decoded).toEqual({ refreshToken: "rt-secret", email: "a@b.com" });
    expect(await decodePendingConnection(undefined)).toBeNull();
    expect(await decodePendingConnection("not-encrypted")).toBeNull();
  });
});

describe("google drive connector — config + consent url", () => {
  it("reports configured and builds a consent url with the read-only scope", () => {
    expect(isGoogleDriveConfigured()).toBe(true);
    const url = buildConsentUrl({ state: "st", redirectUri: "https://app.example.com/cb" });
    expect(url).toContain("accounts.google.com");
    expect(url).toContain("drive.readonly");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("state=st");
  });
});
