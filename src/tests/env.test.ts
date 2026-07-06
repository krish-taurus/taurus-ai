import { describe, it, expect } from "vitest";
import { validateEnv } from "@/lib/env/env";

describe("environment validation", () => {
  it("accepts a valid minimal environment", () => {
    const { server, client } = validateEnv({
      NODE_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    });
    expect(server.NODE_ENV).toBe("development");
    expect(client.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("applies defaults when optional values are absent", () => {
    const { server, client } = validateEnv({});
    expect(server.NODE_ENV).toBe("development");
    expect(client.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("rejects an invalid NODE_ENV", () => {
    expect(() => validateEnv({ NODE_ENV: "staging" })).toThrowError(
      /Invalid environment configuration/,
    );
  });

  it("rejects a malformed public app URL", () => {
    expect(() => validateEnv({ NEXT_PUBLIC_APP_URL: "not-a-url" })).toThrowError(
      /Invalid environment configuration/,
    );
  });

  it("rejects a malformed DATABASE_URL when provided", () => {
    expect(() => validateEnv({ DATABASE_URL: "not-a-url" })).toThrowError(
      /Invalid environment configuration/,
    );
  });
});
