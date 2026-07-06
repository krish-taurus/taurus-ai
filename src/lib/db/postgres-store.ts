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
  ArchiveDnaVersionInput,
  AssignKnowledgeInput,
  AuditEvent,
  AuditEventInput,
  CreateEmployeeInput,
  CreateKnowledgeDocumentInput,
  CreateKnowledgeSourceInput,
  CreateOrganizationInput,
  CreateUserInput,
  DnaStatus,
  DocumentExtractionStatus,
  EmployeeDnaOverview,
  EmployeeDnaVersion,
  EmployeeKnowledgeAssignment,
  EmployeeStatus,
  EmployeeVisibility,
  KnowledgeDocument,
  KnowledgeSource,
  KnowledgeSourceStatus,
  KnowledgeSourceType,
  KnowledgeVaultOverview,
  KnowledgeVisibility,
  Organization,
  OrganizationMember,
  OrganizationMembershipView,
  PublishDnaInput,
  SaveDnaDraftInput,
  UpdateEmployeeInput,
  UpdateKnowledgeSourceInput,
  User,
  WorkingStyle,
} from "@/lib/db/types";
import { isRole, type Role } from "@/modules/organizations/roles";
import type { EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import { DNA_SCHEMA_VERSION } from "@/modules/employee-dna/schema";

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
    responsibilities: Array.isArray(row.responsibilities) ? row.responsibilities : [],
    workingStyle: (row.working_style as WorkingStyle | null) ?? null,
    avatarUrl: row.avatar_url,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapDnaVersion(row: Row): EmployeeDnaVersion {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    versionNumber: row.version_number,
    status: row.status as DnaStatus,
    schemaVersion: row.schema_version,
    dna: row.dna as EmployeeDnaV1,
    createdByUserId: row.created_by_user_id,
    publishedByUserId: row.published_by_user_id,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapKnowledgeSource(row: Row): KnowledgeSource {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    sourceType: row.source_type as KnowledgeSourceType,
    status: row.status as KnowledgeSourceStatus,
    visibility: row.visibility as KnowledgeVisibility,
    createdByUserId: row.created_by_user_id,
    archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapKnowledgeDocument(row: Row): KnowledgeDocument {
  return {
    id: row.id,
    organizationId: row.organization_id,
    knowledgeSourceId: row.knowledge_source_id,
    title: row.title,
    originalFilename: row.original_filename,
    contentType: row.content_type,
    byteSize: row.byte_size,
    checksumSha256: row.checksum_sha256,
    storageKey: row.storage_key,
    textContent: row.text_content,
    textPreview: row.text_preview,
    extractionStatus: row.extraction_status as DocumentExtractionStatus,
    extractionError: row.extraction_error,
    createdByUserId: row.created_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapKnowledgeAssignment(row: Row): EmployeeKnowledgeAssignment {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    knowledgeSourceId: row.knowledge_source_id,
    assignedByUserId: row.assigned_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
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
         (organization_id, name, role_title, department, description, status, visibility,
          responsibilities, working_style, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning *`,
      [
        input.organizationId,
        input.name,
        input.roleTitle,
        input.department ?? null,
        input.description ?? null,
        input.status ?? "draft",
        input.visibility ?? "private",
        JSON.stringify(input.responsibilities ?? []),
        input.workingStyle ? JSON.stringify(input.workingStyle) : null,
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

  // --- Employee DNA (Prompt 005) --------------------------------------------

  async getDraftEmployeeDna(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDnaVersion | null> {
    const { rows } = await this.query(
      `select * from employee_dna_versions
       where organization_id = $1 and employee_id = $2 and status = 'draft' limit 1`,
      [organizationId, employeeId],
    );
    return rows[0] ? mapDnaVersion(rows[0]) : null;
  }

  async getPublishedEmployeeDna(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDnaVersion | null> {
    const { rows } = await this.query(
      `select * from employee_dna_versions
       where organization_id = $1 and employee_id = $2 and status = 'published' limit 1`,
      [organizationId, employeeId],
    );
    return rows[0] ? mapDnaVersion(rows[0]) : null;
  }

  async listEmployeeDnaVersions(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDnaVersion[]> {
    const { rows } = await this.query(
      `select * from employee_dna_versions
       where organization_id = $1 and employee_id = $2
       order by version_number desc`,
      [organizationId, employeeId],
    );
    return rows.map(mapDnaVersion);
  }

  async getEmployeeDnaOverview(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeDnaOverview> {
    const versions = await this.listEmployeeDnaVersions(organizationId, employeeId);
    return {
      draft: versions.find((v) => v.status === "draft") ?? null,
      published: versions.find((v) => v.status === "published") ?? null,
      versions,
    };
  }

  async saveEmployeeDnaDraft(input: SaveDnaDraftInput): Promise<EmployeeDnaVersion> {
    const client: PoolClient = await getPool().connect();
    try {
      await client.query("begin");
      const existing = await client.query(
        `select * from employee_dna_versions
         where organization_id = $1 and employee_id = $2 and status = 'draft'
         for update`,
        [input.organizationId, input.employeeId],
      );

      let row;
      if (existing.rows[0]) {
        const updated = await client.query(
          `update employee_dna_versions set dna = $1, updated_at = now()
           where id = $2 returning *`,
          [JSON.stringify(input.dna), existing.rows[0].id],
        );
        row = updated.rows[0];
      } else {
        const next = await client.query(
          `select coalesce(max(version_number), 0) + 1 as v
           from employee_dna_versions where organization_id = $1 and employee_id = $2`,
          [input.organizationId, input.employeeId],
        );
        const inserted = await client.query(
          `insert into employee_dna_versions
             (organization_id, employee_id, version_number, status, schema_version, dna,
              created_by_user_id)
           values ($1, $2, $3, 'draft', $4, $5, $6)
           returning *`,
          [
            input.organizationId,
            input.employeeId,
            next.rows[0].v,
            DNA_SCHEMA_VERSION,
            JSON.stringify(input.dna),
            input.userId,
          ],
        );
        row = inserted.rows[0];
      }
      await client.query("commit");
      return mapDnaVersion(row);
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }

  async publishEmployeeDna(input: PublishDnaInput): Promise<EmployeeDnaVersion> {
    const client: PoolClient = await getPool().connect();
    try {
      await client.query("begin");
      const draftResult = await client.query(
        `select * from employee_dna_versions
         where organization_id = $1 and employee_id = $2 and status = 'draft'
         for update`,
        [input.organizationId, input.employeeId],
      );
      if (!draftResult.rows[0]) {
        throw new Error("There is no draft Employee DNA to publish.");
      }

      // Archive any previously published version first (one published at a time).
      await client.query(
        `update employee_dna_versions set status = 'archived', updated_at = now()
         where organization_id = $1 and employee_id = $2 and status = 'published'`,
        [input.organizationId, input.employeeId],
      );

      const published = await client.query(
        `update employee_dna_versions
         set status = 'published', published_by_user_id = $1, published_at = now(), updated_at = now()
         where id = $2 returning *`,
        [input.userId, draftResult.rows[0].id],
      );
      await client.query("commit");
      return mapDnaVersion(published.rows[0]);
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }
  }

  async archiveEmployeeDnaVersion(
    input: ArchiveDnaVersionInput,
  ): Promise<EmployeeDnaVersion | null> {
    const { rows } = await this.query(
      `update employee_dna_versions set status = 'archived', updated_at = now()
       where id = $1 and organization_id = $2 and employee_id = $3 returning *`,
      [input.versionId, input.organizationId, input.employeeId],
    );
    return rows[0] ? mapDnaVersion(rows[0]) : null;
  }

  // --- Knowledge Vault (Prompt 006) -----------------------------------------

  async createKnowledgeSource(input: CreateKnowledgeSourceInput): Promise<KnowledgeSource> {
    const { rows } = await this.query(
      `insert into knowledge_sources
         (organization_id, name, description, source_type, status, visibility,
          created_by_user_id, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [
        input.organizationId,
        input.name,
        input.description ?? null,
        input.sourceType,
        input.status ?? "draft",
        input.visibility ?? "organization",
        input.createdByUserId ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return mapKnowledgeSource(rows[0]);
  }

  async listKnowledgeSources(organizationId: string): Promise<KnowledgeSource[]> {
    const { rows } = await this.query(
      "select * from knowledge_sources where organization_id = $1 order by updated_at desc",
      [organizationId],
    );
    return rows.map(mapKnowledgeSource);
  }

  async getKnowledgeSource(
    organizationId: string,
    sourceId: string,
  ): Promise<KnowledgeSource | null> {
    const { rows } = await this.query(
      "select * from knowledge_sources where id = $1 and organization_id = $2",
      [sourceId, organizationId],
    );
    return rows[0] ? mapKnowledgeSource(rows[0]) : null;
  }

  async updateKnowledgeSource(
    organizationId: string,
    sourceId: string,
    patch: UpdateKnowledgeSourceInput,
  ): Promise<KnowledgeSource | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const add = (column: string, value: unknown) => {
      sets.push(`${column} = $${i++}`);
      values.push(value);
    };
    if (patch.name !== undefined) add("name", patch.name);
    if ("description" in patch) add("description", patch.description ?? null);
    if (patch.visibility !== undefined) add("visibility", patch.visibility);
    if (patch.status !== undefined) add("status", patch.status);
    if (sets.length === 0) return this.getKnowledgeSource(organizationId, sourceId);
    sets.push("updated_at = now()");
    values.push(sourceId, organizationId);
    const { rows } = await this.query(
      `update knowledge_sources set ${sets.join(", ")}
       where id = $${i++} and organization_id = $${i} returning *`,
      values,
    );
    return rows[0] ? mapKnowledgeSource(rows[0]) : null;
  }

  async archiveKnowledgeSource(
    organizationId: string,
    sourceId: string,
  ): Promise<KnowledgeSource | null> {
    const { rows } = await this.query(
      `update knowledge_sources set status = 'archived', archived_at = now(), updated_at = now()
       where id = $1 and organization_id = $2 returning *`,
      [sourceId, organizationId],
    );
    return rows[0] ? mapKnowledgeSource(rows[0]) : null;
  }

  async createKnowledgeDocument(input: CreateKnowledgeDocumentInput): Promise<KnowledgeDocument> {
    const { rows } = await this.query(
      `insert into knowledge_documents
         (organization_id, knowledge_source_id, title, original_filename, content_type,
          byte_size, checksum_sha256, storage_key, text_content, text_preview,
          extraction_status, extraction_error, created_by_user_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       returning *`,
      [
        input.organizationId,
        input.knowledgeSourceId,
        input.title,
        input.originalFilename ?? null,
        input.contentType ?? null,
        input.byteSize ?? null,
        input.checksumSha256 ?? null,
        input.storageKey ?? null,
        input.textContent ?? null,
        input.textPreview ?? null,
        input.extractionStatus ?? "not_required",
        input.extractionError ?? null,
        input.createdByUserId ?? null,
      ],
    );
    return mapKnowledgeDocument(rows[0]);
  }

  async listKnowledgeDocumentsForSource(
    organizationId: string,
    sourceId: string,
  ): Promise<KnowledgeDocument[]> {
    const { rows } = await this.query(
      `select * from knowledge_documents
       where organization_id = $1 and knowledge_source_id = $2 order by created_at asc`,
      [organizationId, sourceId],
    );
    return rows.map(mapKnowledgeDocument);
  }

  async getKnowledgeDocument(
    organizationId: string,
    documentId: string,
  ): Promise<KnowledgeDocument | null> {
    const { rows } = await this.query(
      "select * from knowledge_documents where id = $1 and organization_id = $2",
      [documentId, organizationId],
    );
    return rows[0] ? mapKnowledgeDocument(rows[0]) : null;
  }

  async assignKnowledgeSourceToEmployee(
    input: AssignKnowledgeInput,
  ): Promise<EmployeeKnowledgeAssignment> {
    const { rows } = await this.query(
      `insert into employee_knowledge_sources
         (organization_id, employee_id, knowledge_source_id, assigned_by_user_id)
       values ($1, $2, $3, $4)
       on conflict (employee_id, knowledge_source_id) do update set employee_id = excluded.employee_id
       returning *`,
      [
        input.organizationId,
        input.employeeId,
        input.knowledgeSourceId,
        input.assignedByUserId ?? null,
      ],
    );
    return mapKnowledgeAssignment(rows[0]);
  }

  async unassignKnowledgeSourceFromEmployee(
    organizationId: string,
    employeeId: string,
    knowledgeSourceId: string,
  ): Promise<boolean> {
    const { rowCount } = await this.query(
      `delete from employee_knowledge_sources
       where organization_id = $1 and employee_id = $2 and knowledge_source_id = $3`,
      [organizationId, employeeId, knowledgeSourceId],
    );
    return (rowCount ?? 0) > 0;
  }

  async listKnowledgeSourcesForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<KnowledgeSource[]> {
    const { rows } = await this.query(
      `select s.* from knowledge_sources s
       join employee_knowledge_sources a on a.knowledge_source_id = s.id
       where a.organization_id = $1 and a.employee_id = $2
       order by s.updated_at desc`,
      [organizationId, employeeId],
    );
    return rows.map(mapKnowledgeSource);
  }

  async listEmployeesForKnowledgeSource(
    organizationId: string,
    knowledgeSourceId: string,
  ): Promise<AiEmployee[]> {
    const { rows } = await this.query(
      `select e.* from ai_employees e
       join employee_knowledge_sources a on a.employee_id = e.id
       where a.organization_id = $1 and a.knowledge_source_id = $2
       order by e.name asc`,
      [organizationId, knowledgeSourceId],
    );
    return rows.map(mapEmployee);
  }

  async countAssignedKnowledgeForEmployee(
    organizationId: string,
    employeeId: string,
  ): Promise<number> {
    const { rows } = await this.query(
      `select count(*)::int as n from employee_knowledge_sources
       where organization_id = $1 and employee_id = $2`,
      [organizationId, employeeId],
    );
    return rows[0]?.n ?? 0;
  }

  async getKnowledgeVaultOverview(organizationId: string): Promise<KnowledgeVaultOverview> {
    const sources = (await this.listKnowledgeSources(organizationId)).filter(
      (s) => s.status !== "archived",
    );
    const { rows } = await this.query(
      "select distinct knowledge_source_id from employee_knowledge_sources where organization_id = $1",
      [organizationId],
    );
    const assignedIds = new Set(rows.map((r: Row) => r.knowledge_source_id));
    return {
      total: sources.length,
      ready: sources.filter((s) => s.status === "ready").length,
      assigned: sources.filter((s) => assignedIds.has(s.id)).length,
      recent: sources.slice(0, 5),
    };
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
