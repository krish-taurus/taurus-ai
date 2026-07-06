/**
 * PostgreSQL-ready database layer (placeholder for Prompt 001).
 *
 * Taurus AI targets PostgreSQL with a pgvector-ready schema. The real client
 * (connection pool + query layer) is introduced in Prompt 002: Database, Auth,
 * and Tenancy. For now this module documents the intended shape and provides a
 * safe no-op guard so nothing accidentally talks to a database that is not yet
 * configured.
 *
 * TENANCY RULE (enforced from Prompt 002 onward): every tenant-scoped query must
 * be filtered by organization_id and validated against organization membership.
 */

import { getServerEnv } from "@/lib/env/env";

export interface DbClient {
  /** True once a real connection has been established. */
  readonly isConnected: boolean;
}

/**
 * Returns the database client. In Prompt 001 there is no live connection; this
 * throws a clear error if used, so missing wiring is obvious rather than silent.
 */
export function getDbClient(): DbClient {
  const { DATABASE_URL } = getServerEnv();

  if (!DATABASE_URL) {
    throw new Error(
      "Database is not configured yet. Set DATABASE_URL and wire up the client " +
        "in Prompt 002 (Database, Auth, and Tenancy).",
    );
  }

  // Placeholder: a real pooled client is added in Prompt 002.
  throw new Error("Database client is not implemented until Prompt 002.");
}
