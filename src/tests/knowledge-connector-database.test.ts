// @vitest-environment node
// The database connector uses the pg driver + node net/dns, so it runs in the
// node environment (matching the server runtime), not a browser DOM.
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  assertReadOnlyQuery,
  formatRows,
  runDatabaseQuery,
  executeReadOnlyQuery,
  DatabaseConnectorError,
} from "@/modules/knowledge/connectors/database";

describe("database connector — query safety", () => {
  it("accepts single read-only SELECT / WITH queries", () => {
    expect(assertReadOnlyQuery("select * from faqs")).toBe("select * from faqs");
    expect(assertReadOnlyQuery("  SELECT id FROM t;  ")).toBe("SELECT id FROM t");
    expect(assertReadOnlyQuery("with x as (select 1) select * from x")).toContain("with x");
  });

  it("rejects writes, DDL, multiple statements, and comment-hidden writes", () => {
    for (const bad of [
      "insert into t values (1)",
      "update t set a=1",
      "delete from t",
      "drop table t",
      "select 1; drop table t",
      "select 1 -- ok\n; delete from t",
      "truncate t",
      "grant all on t to public",
      "copy t to '/tmp/x'",
      "",
    ]) {
      expect(() => assertReadOnlyQuery(bad)).toThrow(DatabaseConnectorError);
    }
  });

  it("formats rows as readable records", () => {
    const text = formatRows([
      { question: "Return policy?", answer: "30 days" },
      { question: "Where based?", answer: "Singapore" },
    ]);
    expect(text).toContain("question: Return policy?");
    expect(text).toContain("answer: 30 days");
    expect(text).toContain("Singapore");
  });

  it("blocks private/loopback database hosts (SSRF)", async () => {
    await expect(
      runDatabaseQuery({
        kind: "postgres",
        connectionString: "postgres://u:p@127.0.0.1:5432/db",
        query: "select 1",
      }),
    ).rejects.toThrow(/not reachable/i);
  });

  // Integration: real query execution against a local Postgres, if provided.
  const TEST_PG = process.env.TEST_PG_URL;
  it.skipIf(!TEST_PG)("reads rows from a real database into text", async () => {
    const res = await executeReadOnlyQuery(TEST_PG as string, "select question, answer from faqs");
    expect(res.status).toBe("extracted");
    expect(res.rowCount).toBeGreaterThan(0);
    expect(res.text).toContain("30 days");
  });

  it.skipIf(!TEST_PG)("a READ ONLY transaction rejects a write at the database", async () => {
    // The wrapping subquery makes this invalid too, but the read-only tx is the
    // real guard — either way it must not succeed.
    await expect(
      executeReadOnlyQuery(TEST_PG as string, "create table _hack(i int)"),
    ).rejects.toThrow();
  });
});
