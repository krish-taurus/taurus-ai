/**
 * Data store abstraction (Prompt 002).
 *
 * The application talks to a `DataStore`, never directly to a database driver.
 * Two implementations exist:
 *   - InMemoryStore   — used when DATABASE_URL is unset (local dev + tests).
 *   - PostgresStore   — used when DATABASE_URL is set (real PostgreSQL).
 *
 * This keeps tenant-isolation logic testable without a live database while still
 * shipping a real PostgreSQL foundation.
 */

import type {
  AuditEvent,
  AuditEventInput,
  CreateOrganizationInput,
  CreateUserInput,
  Organization,
  OrganizationMember,
  OrganizationMembershipView,
  User,
} from "@/lib/db/types";
import type { Role } from "@/modules/organizations/roles";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { PostgresStore } from "@/lib/db/postgres-store";

export interface DataStore {
  // Users
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(input: CreateUserInput): Promise<User>;

  // Organizations + memberships
  getOrganizationById(id: string): Promise<Organization | null>;
  getOrganizationBySlug(slug: string): Promise<Organization | null>;
  listOrganizationsForUser(userId: string): Promise<OrganizationMembershipView[]>;
  getMembership(organizationId: string, userId: string): Promise<OrganizationMember | null>;

  /**
   * Atomically create an organization and its owner membership. Returns both.
   * Implementations must ensure the owner membership is created for the org.
   */
  createOrganizationWithOwner(input: {
    organization: CreateOrganizationInput;
    ownerUserId: string;
    ownerRole?: Role;
  }): Promise<OrganizationMembershipView>;

  // Tenant-isolation seam for employees (no employees exist until Prompt 003).
  getEmployeeOrganizationId(employeeId: string): Promise<string | null>;

  // Audit
  createAuditEvent(input: AuditEventInput): Promise<AuditEvent>;
}

/**
 * The store is pinned on globalThis (not a module-level `let`) so it survives
 * module re-evaluation. In Next.js dev, on-demand route compilation and HMR can
 * create fresh module instances; a plain module singleton would then hand
 * different requests different in-memory stores, losing data written by a prior
 * request (e.g. a user created during sign-up). globalThis guarantees a single
 * instance across the whole server process.
 */
const globalForStore = globalThis as unknown as { __taurusStore?: DataStore };

/**
 * Returns the process-wide data store, selecting the backend from the
 * environment. This module is imported only by server code (guards, server
 * actions), never by client or edge/middleware code, so the pg driver never
 * reaches the browser or the edge runtime.
 */
export function getStore(): DataStore {
  if (!globalForStore.__taurusStore) {
    globalForStore.__taurusStore = process.env.DATABASE_URL
      ? new PostgresStore()
      : new InMemoryStore();
  }
  return globalForStore.__taurusStore;
}

/** Test helper: reset the cached store between tests. */
export function __resetStoreForTests(store?: DataStore): void {
  globalForStore.__taurusStore = store;
}
