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
  AiEmployee,
  AuditEvent,
  AuditEventInput,
  CreateEmployeeInput,
  CreateOrganizationInput,
  CreateUserInput,
  EmployeeStatus,
  EmployeeVisibility,
  Organization,
  OrganizationMember,
  OrganizationMembershipView,
  UpdateEmployeeInput,
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

function mapEmployee(row: Row): AiEmployee {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    roleTitle: row.role_title,
    department: row.department,
    description: row.description,
    status: row.status as EmployeeStatus,
    visibility: row.visibility as EmployeeVisibility,
    avatarUrl: row.avatar_url,
    createdBy: row.created_by,
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

  async createEmployee(input: CreateEmployeeInput): Promise<AiEmployee> {
    const { rows } = await this.query(
      `insert into ai_employees
         (organization_id, name, role_title, department, description, status, visibility, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [
        input.organizationId,
        input.name,
        input.roleTitle,
        input.department ?? null,
        input.description ?? null,
        input.status ?? "draft",
        input.visibility ?? "private",
        input.createdBy ?? null,
      ],
    );
    return mapEmployee(rows[0]);
  }

  async listEmployees(organizationId: string): Promise<AiEmployee[]> {
    const { rows } = await this.query(
      "select * from ai_employees where organization_id = $1 order by updated_at desc",
      [organizationId],
    );
    return rows.map(mapEmployee);
  }

  async getEmployee(organizationId: string, employeeId: string): Promise<AiEmployee | null> {
    // Organization scoping is part of the WHERE clause: an employee id from
    // another organization simply returns no row.
    const { rows } = await this.query(
      "select * from ai_employees where id = $1 and organization_id = $2",
      [employeeId, organizationId],
    );
    return rows[0] ? mapEmployee(rows[0]) : null;
  }

  async updateEmployee(
    organizationId: string,
    employeeId: string,
    patch: UpdateEmployeeInput,
  ): Promise<AiEmployee | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const add = (column: string, value: unknown) => {
      sets.push(`${column} = $${i++}`);
      values.push(value);
    };

    if (patch.name !== undefined) add("name", patch.name);
    if (patch.roleTitle !== undefined) add("role_title", patch.roleTitle);
    if ("department" in patch) add("department", patch.department ?? null);
    if ("description" in patch) add("description", patch.description ?? null);
    if (patch.status !== undefined) add("status", patch.status);
    if (patch.visibility !== undefined) add("visibility", patch.visibility);

    if (sets.length === 0) return this.getEmployee(organizationId, employeeId);

    sets.push("updated_at = now()");
    values.push(employeeId, organizationId);
    const { rows } = await this.query(
      `update ai_employees set ${sets.join(", ")}
       where id = $${i++} and organization_id = $${i} returning *`,
      values,
    );
    return rows[0] ? mapEmployee(rows[0]) : null;
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
