/**
 * Database entry point (Prompt 002).
 *
 * Import the data store from here. The concrete backend (in-memory vs.
 * PostgreSQL) is selected by `getStore()` based on the environment, so callers
 * never depend on a specific driver.
 */

export { getStore, __resetStoreForTests } from "@/lib/db/store";
export type { DataStore } from "@/lib/db/store";
export type * from "@/lib/db/types";
