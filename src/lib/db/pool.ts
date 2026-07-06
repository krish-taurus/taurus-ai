/**
 * Lazy PostgreSQL connection pool (Prompt 002).
 *
 * Only instantiated when DATABASE_URL is set. Kept in a module-level singleton so
 * the whole server process shares one pool. Never imported by client/edge code.
 */

import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set; the PostgreSQL pool cannot be created.");
  }
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}
