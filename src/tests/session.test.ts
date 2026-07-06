import { describe, it, expect, beforeAll } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/security/session";

const SECRET = "test-secret-that-is-long-enough-123";

describe("signed session tokens", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = SECRET;
  });

  it("round-trips a valid token", async () => {
    const token = await createSessionToken("user-123");
    const payload = await verifySessionToken(token);
    expect(payload?.uid).toBe("user-123");
    expect(typeof payload?.iat).toBe("number");
  });

  it("rejects a tampered payload", async () => {
    const token = await createSessionToken("user-123");
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ uid: "attacker", iat: Date.now() }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const forged = `${forgedPayload}.${signature}`;
    expect(await verifySessionToken(forged)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken("user-123");
    process.env.AUTH_SECRET = "a-completely-different-secret-value";
    expect(await verifySessionToken(token)).toBeNull();
    process.env.AUTH_SECRET = SECRET;
  });

  it("rejects malformed tokens", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("")).toBeNull();
    expect(await verifySessionToken("not-a-token")).toBeNull();
    expect(await verifySessionToken("only.two.parts.here")).toBeNull();
  });
});
