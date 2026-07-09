import "server-only";

/**
 * Database knowledge connector (Sprint 022).
 *
 * Runs a read-only query against an external customer database and turns the rows
 * into plain text that feeds the Knowledge Vault → index → retrieval pipeline, so
 * an AI Employee can answer from structured data (a product catalog, an FAQ
 * table, a policy table, …). Supports **PostgreSQL** and **MySQL**.
 *
 * SAFETY:
 *  - The query must be a single read-only statement (validated), AND it runs
 *    inside a `READ ONLY` transaction with a statement timeout, so the database
 *    itself rejects any write even if the text check is somehow bypassed.
 *  - The connection host must resolve to a public address (no localhost / private
 *    ranges / cloud-metadata), like the website connector.
 *  - Rows and total text are capped to keep ingestion bounded.
 *  - Callers should still use a least-privilege, read-only database user.
 */

import { Client } from "pg";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { DocumentExtractionStatus } from "@/lib/db/types";

export type DatabaseKind = "postgres" | "mysql";

export interface DatabaseQueryResult {
  text: string | null;
  rowCount: number;
  status: DocumentExtractionStatus;
}

const MAX_ROWS = 5_000;
const MAX_TEXT_CHARS = 500_000;
const STATEMENT_TIMEOUT_MS = 8_000;
const CONNECT_TIMEOUT_MS = 8_000;

/** Keywords that must never appear in a read-only knowledge query. */
const FORBIDDEN = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "create",
  "truncate",
  "grant",
  "revoke",
  "copy",
  "merge",
  "call",
  "vacuum",
  "analyze",
  "comment",
  "reindex",
  "cluster",
  "lock",
];

export class DatabaseConnectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConnectorError";
  }
}

/** Strip SQL comments so they can't hide a forbidden keyword. */
function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** Validate the query is a single, read-only SELECT/WITH statement. */
export function assertReadOnlyQuery(rawSql: string): string {
  const sql = stripSqlComments(rawSql).trim().replace(/;\s*$/, "");
  if (!sql) throw new DatabaseConnectorError("Enter a SQL query.");
  if (sql.includes(";")) {
    throw new DatabaseConnectorError("Only a single statement is allowed (remove extra `;`).");
  }
  if (!/^(select|with)\b/i.test(sql)) {
    throw new DatabaseConnectorError("Only read-only SELECT queries are allowed.");
  }
  const lower = ` ${sql.toLowerCase()} `;
  for (const word of FORBIDDEN) {
    if (new RegExp(`[^a-z0-9_]${word}[^a-z0-9_]`).test(lower)) {
      throw new DatabaseConnectorError(`This query looks like it modifies data ("${word}").`);
    }
  }
  return sql;
}

function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p[0] === 10 || p[0] === 127 || p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    return p[0] >= 224;
  }
  if (v === 6) {
    const l = ip.toLowerCase();
    return l === "::1" || l === "::" || l.startsWith("fe80") || l.startsWith("fc") || l.startsWith("fd");
  }
  return true;
}

async function assertPublicDbHost(connectionString: string): Promise<void> {
  let host: string;
  try {
    host = new URL(connectionString).hostname.toLowerCase();
  } catch {
    throw new DatabaseConnectorError("Enter a valid database connection string.");
  }
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new DatabaseConnectorError("That database host is not reachable.");
  }
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateIp)) {
    throw new DatabaseConnectorError("That database host is not reachable.");
  }
}

/** Render rows as readable "column: value" records, capped for indexing. */
export function formatRows(rows: Record<string, unknown>[]): string {
  const records: string[] = [];
  let total = 0;
  for (const row of rows) {
    const lines = Object.entries(row)
      .map(([k, v]) => `${k}: ${v === null || v === undefined ? "" : String(v)}`)
      .join("\n");
    if (total + lines.length > MAX_TEXT_CHARS) break;
    records.push(lines);
    total += lines.length + 2;
  }
  return records.join("\n\n");
}

/** Run a validated read-only query against a PostgreSQL or MySQL database. */
export async function runDatabaseQuery(input: {
  kind: DatabaseKind;
  connectionString: string;
  query: string;
}): Promise<DatabaseQueryResult> {
  const sql = assertReadOnlyQuery(input.query);
  await assertPublicDbHost(input.connectionString);
  return input.kind === "mysql"
    ? executeMysqlReadOnlyQuery(input.connectionString, sql)
    : executeReadOnlyQuery(input.connectionString, sql);
}

/**
 * Execute a pre-validated read-only SELECT against **PostgreSQL** and format the
 * rows. Exported so integration tests can exercise it against a local database —
 * the public-host SSRF guard is applied by `runDatabaseQuery`, not here.
 */
export async function executeReadOnlyQuery(
  connectionString: string,
  sql: string,
): Promise<DatabaseQueryResult> {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    query_timeout: STATEMENT_TIMEOUT_MS,
  });

  try {
    await client.connect();
    // A READ ONLY transaction is the real guardrail — the DB rejects any write.
    await client.query("begin transaction read only");
    // Wrap the user's SELECT as a subquery and cap rows at the DB, so a huge
    // result never streams fully into memory.
    const wrapped = `select * from (${sql}) as taurus_source limit ${MAX_ROWS}`;
    const result = await client.query(wrapped);
    await client.query("rollback").catch(() => {});

    const rows = result.rows as Record<string, unknown>[];
    const text = formatRows(rows).trim();
    return {
      text: text.length > 0 ? text : null,
      rowCount: rows.length,
      status: text.length > 0 ? "extracted" : "failed",
    };
  } catch (err) {
    if (err instanceof DatabaseConnectorError) throw err;
    throw new DatabaseConnectorError(
      err instanceof Error ? `Could not read from the database: ${err.message}` : "Database error.",
    );
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Execute a pre-validated read-only SELECT against **MySQL** and format the rows.
 * Exported for the same integration-test reason as the PostgreSQL variant; the
 * SSRF host guard is applied by `runDatabaseQuery`.
 */
export async function executeMysqlReadOnlyQuery(
  connectionString: string,
  sql: string,
): Promise<DatabaseQueryResult> {
  // Dynamic import so the pg path never pays for the mysql driver, and vice versa.
  const mysql = await import("mysql2/promise");
  // multipleStatements defaults to false → the driver itself rejects stacked SQL.
  const conn = await mysql.createConnection({
    uri: connectionString,
    connectTimeout: CONNECT_TIMEOUT_MS,
  });

  try {
    // Best-effort per-statement timeout (MySQL 5.7.8+; ignored where unsupported).
    await conn.query(`set session max_execution_time = ${STATEMENT_TIMEOUT_MS}`).catch(() => {});
    // A READ ONLY transaction is the real guardrail — the DB rejects any write.
    await conn.query("start transaction read only");
    const wrapped = `select * from (${sql}) as taurus_source limit ${MAX_ROWS}`;
    const [rowsRaw] = await conn.query(wrapped);
    await conn.query("rollback").catch(() => {});

    const rows = (Array.isArray(rowsRaw) ? rowsRaw : []) as Record<string, unknown>[];
    const text = formatRows(rows).trim();
    return {
      text: text.length > 0 ? text : null,
      rowCount: rows.length,
      status: text.length > 0 ? "extracted" : "failed",
    };
  } catch (err) {
    if (err instanceof DatabaseConnectorError) throw err;
    throw new DatabaseConnectorError(
      err instanceof Error ? `Could not read from the database: ${err.message}` : "Database error.",
    );
  } finally {
    await conn.end().catch(() => {});
  }
}
