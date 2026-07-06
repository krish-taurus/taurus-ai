/**
 * PostgreSQL-backed DataStore (Prompt 002).
 *
 * Used when DATABASE_URL is set. Every method maps snake_case columns to the
 * camelCase entity types. Tenant isolation is enforced by callers via the
 * security guards; this layer only executes scoped queries.
 *
 * NOTE: exercising this path requires a live PostgreSQL with the migrations in
 * db/migrations applied. The in-memory store is used for local dev/tests.
 */

import type { PoolClient } from "pg";
import { getPool } from "@/lib/db/pool";
import type { DataStore } from "@/lib/db/store";
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
import { isRole, type Role } from "@/modules/organizations/roles";

// Row shapes come from pg as untyped records; map them explicitly below.
type Row = Record<string, any>;

function mapUser(row: Row): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapOrganization(row: Row): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    industry: row.industry,
    websiteUrl: row.website_url,
    sizeRange: row.size_range,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapMembership(row: Row): OrganizationMember {
  const role: Role = isRole(row.role) ? row.role : "viewer";
  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id,
    role,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class PostgresStore implements DataStore {
  private query(text: string, params?: unknown[]) {
    return getPool().query(text, params as any[]);
  }

  async getUserById(id: string): Promise<User | null> {
    const { rows } = await this.query("select * from users where id = $1", [id]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const { rows } = await this.query("select * from users where email = $1", [
      email.trim().toLowerCase(),
    ]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const { rows } = await this.query(
      "insert into users (email, full_name) values ($1, $2) returning *",
      [input.email.trim().toLowerCase(), input.fullName?.trim() || null],
    );
    return mapUser(rows[0]);
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    const { rows } = await this.query("select * from organizations where id = $1", [id]);
    return rows[0] ? mapOrganization(rows[0]) : null;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const { rows } = await this.query("select * from organizations where slug = $1", [slug]);
    return rows[0] ? mapOrganization(rows[0]) : null;
  }

  async listOrganizationsForUser(userId: string): Promise<OrganizationMembershipView[]> {
    const { rows } = await this.query(
      `select
         o.id as o_id, o.name, o.slug, o.industry, o.website_url, o.size_range,
         o.created_at as o_created_at, o.updated_at as o_updated_at,
         m.id as m_id, m.organization_id, m.user_id, m.role, m.status,
         m.created_at as m_created_at, m.updated_at as m_updated_at
       from organization_members m
       join organizations o on o.id = m.organization_id
       where m.user_id = $1
       order by o.name asc`,
      [userId],
    );
    return rows.map((row: Row) => ({
      organization: mapOrganization({
        id: row.o_id,
        name: row.name,
        slug: row.slug,
        industry: row.industry,
        website_url: row.website_url,
        size_range: row.size_range,
        created_at: row.o_created_at,
        updated_at: row.o_updated_at,
      }),
      membership: mapMembership({
        id: row.m_id,
        organization_id: row.organization_id,
        user_id: row.user_id,
        role: row.role,
        status: row.status,
        created_at: row.m_created_at,
        updated_at: row.m_updated_at,
      }),
    }));
  }

  async getMembership(organizationId: string, userId: string): Promise<OrganizationMember | null> {
    const { rows } = await this.query(
      "select * from organization_members where organization_id = $1 and user_id = $2",
      [organizationId, userId],
    );
    return rows[0] ? mapMembership(rows[0]) : null;
  }

  async createOrganizationWithOwner(input: {
    organization: CreateOrganizationInput;
    ownerUserId: string;
    ownerRole?: Role;
  }): Promise<OrganizationMembershipView> {
    const client: PoolClient = await getPool().connect();
    try {
      await client.query("begin");
      const orgResult = await client.query(
        `insert into organizations (name, slug, industry, website_url, size_range)
         values ($1, $2, $3, $4, $5) returning *`,
        [
          input.organization.name,
          input.organization.slug,
          input.organization.industry ?? null,
          input.organization.websiteUrl ?? null,
          input.organization.sizeRange ?? null,
        ],
      );
      const organization = mapOrganization(orgResult.rows[0]);

      const memberResult = await client.query(
        `insert into organization_members (organization_id, user_id, role, status)
         values ($1, $2, $3, 'active') returning *`,
        [organization.id, input.ownerUserId, input.ownerRole ?? "owner"],
      );
      const membership = mapMembership(memberResult.rows[0]);

      await client.query("commit");
      return { organization, membership };
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }

  async getEmployeeOrganizationId(employeeId: string): Promise<string | null> {
    const { rows } = await this.query("select organization_id from ai_employees where id = $1", [
      employeeId,
    ]);
    return rows[0]?.organization_id ?? null;
  }

  async createAuditEvent(input: AuditEventInput): Promise<AuditEvent> {
    const { rows } = await this.query(
      `insert into audit_events
         (organization_id, actor_type, actor_id, action, target_type, target_id, metadata)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, created_at`,
      [
        input.organizationId,
        input.actorType,
        input.actorId,
        input.action,
        input.targetType ?? null,
        input.targetId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return {
      ...input,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? {},
      id: rows[0].id,
      createdAt: new Date(rows[0].created_at).toISOString(),
    };
  }
}
