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
  CreateLlmUsageEventInput,
  CreateOrganizationInput,
  CreateUserInput,
  CredentialMode,
  CredentialStatus,
  DnaStatus,
  DocumentExtractionStatus,
  EmployeeDnaOverview,
  EmployeeDnaVersion,
  EmployeeKnowledgeAssignment,
  EmployeeModelSettings,
  EmployeeStatus,
  EmployeeVisibility,
  KnowledgeDocument,
  KnowledgeSource,
  KnowledgeSourceStatus,
  KnowledgeSourceType,
  KnowledgeVaultOverview,
  KnowledgeVisibility,
  LlmTaskType,
  LlmUsageEvent,
  LlmUsageStatus,
  ModelHubOverview,
  Organization,
  OrganizationMember,
  OrganizationMembershipView,
  OrganizationModelSettings,
  ProviderCredentialMetadata,
  ProviderSlug,
  PublishDnaInput,
  RoutingMode,
  SaveDnaDraftInput,
  SaveProviderCredentialInput,
  UpdateEmployeeInput,
  UpdateEmployeeModelSettingsInput,
  UpdateKnowledgeSourceInput,
  UpdateOrganizationModelSettingsInput,
  User,
  WorkingStyle,
} from "@/lib/db/types";
import type { AiModel, ModelProvider } from "@/modules/model-gateway/types";
import {
  AI_MODELS,
  MODEL_PROVIDERS,
  getModel,
  modelsByProvider,
} from "@/modules/model-gateway/catalog";
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

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function slugArray(value: unknown): ProviderSlug[] {
  return Array.isArray(value) ? (value as ProviderSlug[]) : [];
}

function mapOrgModelSettings(row: Row): OrganizationModelSettings {
  return {
    id: row.id,
    organizationId: row.organization_id,
    defaultModelId: row.default_model_id,
    routingMode: row.routing_mode as RoutingMode,
    allowedProviderSlugs: slugArray(row.allowed_provider_slugs),
    blockedProviderSlugs: slugArray(row.blocked_provider_slugs),
    monthlyBudgetUsd: num(row.monthly_budget_usd),
    budgetAlertThresholdPercent: num(row.budget_alert_threshold_percent),
    fallbackModelId: row.fallback_model_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapEmployeeModelSettings(row: Row): EmployeeModelSettings {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    modelId: row.model_id,
    routingMode: (row.routing_mode as RoutingMode | null) ?? null,
    maxMonthlyBudgetUsd: num(row.max_monthly_budget_usd),
    fallbackModelId: row.fallback_model_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** Maps a credential row to client-safe metadata — the encrypted key is dropped. */
function mapCredentialMetadata(row: Row): ProviderCredentialMetadata {
  return {
    id: row.id,
    organizationId: row.organization_id,
    providerSlug: row.provider_slug as ProviderSlug,
    credentialMode: row.credential_mode as CredentialMode,
    keyLastFour: row.key_last_four,
    status: row.status as CredentialStatus,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapUsageEvent(row: Row): LlmUsageEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    providerSlug: row.provider_slug as ProviderSlug,
    modelId: row.model_id,
    taskType: row.task_type as LlmTaskType,
    inputTokens: row.input_tokens,
    cachedInputTokens: row.cached_input_tokens,
    outputTokens: row.output_tokens,
    estimatedCostUsd: num(row.estimated_cost_usd),
    latencyMs: row.latency_ms,
    status: row.status as LlmUsageStatus,
    errorCode: row.error_code,
    requestIdHash: row.request_id_hash,
    createdByUserId: row.created_by_user_id,
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

  // --- Model Hub + LLM Gateway (Prompt 006B) --------------------------------
  // The catalog is code-authoritative; these read from the code catalog so both
  // stores return identical data regardless of DB seed state.

  async listModelProviders(): Promise<ModelProvider[]> {
    return [...MODEL_PROVIDERS];
  }

  async listAiModels(): Promise<AiModel[]> {
    return [...AI_MODELS];
  }

  async getAiModel(modelId: string): Promise<AiModel | null> {
    return getModel(modelId);
  }

  async getModelsByProvider(providerSlug: ProviderSlug): Promise<AiModel[]> {
    return modelsByProvider(providerSlug);
  }

  async getOrganizationModelSettings(organizationId: string): Promise<OrganizationModelSettings> {
    const { rows } = await this.query(
      "select * from organization_model_settings where organization_id = $1",
      [organizationId],
    );
    if (rows[0]) return mapOrgModelSettings(rows[0]);
    const inserted = await this.query(
      `insert into organization_model_settings (organization_id)
       values ($1)
       on conflict (organization_id) do update set organization_id = excluded.organization_id
       returning *`,
      [organizationId],
    );
    return mapOrgModelSettings(inserted.rows[0]);
  }

  async updateOrganizationModelSettings(
    organizationId: string,
    patch: UpdateOrganizationModelSettingsInput,
  ): Promise<OrganizationModelSettings> {
    const current = await this.getOrganizationModelSettings(organizationId);
    const next = {
      defaultModelId:
        patch.defaultModelId !== undefined ? patch.defaultModelId : current.defaultModelId,
      routingMode: patch.routingMode ?? current.routingMode,
      allowedProviderSlugs: patch.allowedProviderSlugs ?? current.allowedProviderSlugs,
      blockedProviderSlugs: patch.blockedProviderSlugs ?? current.blockedProviderSlugs,
      monthlyBudgetUsd:
        patch.monthlyBudgetUsd !== undefined ? patch.monthlyBudgetUsd : current.monthlyBudgetUsd,
      budgetAlertThresholdPercent:
        patch.budgetAlertThresholdPercent !== undefined
          ? patch.budgetAlertThresholdPercent
          : current.budgetAlertThresholdPercent,
      fallbackModelId:
        patch.fallbackModelId !== undefined ? patch.fallbackModelId : current.fallbackModelId,
      updatedByUserId: patch.updatedByUserId ?? current.updatedByUserId,
    };
    const { rows } = await this.query(
      `update organization_model_settings set
         default_model_id = $2,
         routing_mode = $3,
         allowed_provider_slugs = $4,
         blocked_provider_slugs = $5,
         monthly_budget_usd = $6,
         budget_alert_threshold_percent = $7,
         fallback_model_id = $8,
         updated_by_user_id = $9,
         updated_at = now()
       where organization_id = $1
       returning *`,
      [
        organizationId,
        next.defaultModelId,
        next.routingMode,
        JSON.stringify(next.allowedProviderSlugs),
        JSON.stringify(next.blockedProviderSlugs),
        next.monthlyBudgetUsd,
        next.budgetAlertThresholdPercent,
        next.fallbackModelId,
        next.updatedByUserId,
      ],
    );
    return mapOrgModelSettings(rows[0]);
  }

  async getEmployeeModelSettings(
    organizationId: string,
    employeeId: string,
  ): Promise<EmployeeModelSettings | null> {
    const { rows } = await this.query(
      "select * from employee_model_settings where organization_id = $1 and employee_id = $2",
      [organizationId, employeeId],
    );
    return rows[0] ? mapEmployeeModelSettings(rows[0]) : null;
  }

  async updateEmployeeModelSettings(
    organizationId: string,
    employeeId: string,
    patch: UpdateEmployeeModelSettingsInput,
  ): Promise<EmployeeModelSettings> {
    const current = await this.getEmployeeModelSettings(organizationId, employeeId);
    const next = {
      modelId: patch.modelId !== undefined ? patch.modelId : (current?.modelId ?? null),
      routingMode:
        patch.routingMode !== undefined ? patch.routingMode : (current?.routingMode ?? null),
      maxMonthlyBudgetUsd:
        patch.maxMonthlyBudgetUsd !== undefined
          ? patch.maxMonthlyBudgetUsd
          : (current?.maxMonthlyBudgetUsd ?? null),
      fallbackModelId:
        patch.fallbackModelId !== undefined
          ? patch.fallbackModelId
          : (current?.fallbackModelId ?? null),
      updatedByUserId: patch.updatedByUserId ?? current?.updatedByUserId ?? null,
    };
    const { rows } = await this.query(
      `insert into employee_model_settings
         (organization_id, employee_id, model_id, routing_mode, max_monthly_budget_usd,
          fallback_model_id, updated_by_user_id)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (employee_id) do update set
         model_id = excluded.model_id,
         routing_mode = excluded.routing_mode,
         max_monthly_budget_usd = excluded.max_monthly_budget_usd,
         fallback_model_id = excluded.fallback_model_id,
         updated_by_user_id = excluded.updated_by_user_id,
         updated_at = now()
       returning *`,
      [
        organizationId,
        employeeId,
        next.modelId,
        next.routingMode,
        next.maxMonthlyBudgetUsd,
        next.fallbackModelId,
        next.updatedByUserId,
      ],
    );
    return mapEmployeeModelSettings(rows[0]);
  }

  async getProviderCredentialMetadata(
    organizationId: string,
    providerSlug: ProviderSlug,
  ): Promise<ProviderCredentialMetadata | null> {
    const { rows } = await this.query(
      `select id, organization_id, provider_slug, credential_mode, key_last_four, status,
              created_by_user_id, updated_by_user_id, created_at, updated_at
       from organization_provider_credentials
       where organization_id = $1 and provider_slug = $2`,
      [organizationId, providerSlug],
    );
    return rows[0] ? mapCredentialMetadata(rows[0]) : null;
  }

  async listProviderCredentialMetadata(
    organizationId: string,
  ): Promise<ProviderCredentialMetadata[]> {
    const { rows } = await this.query(
      `select id, organization_id, provider_slug, credential_mode, key_last_four, status,
              created_by_user_id, updated_by_user_id, created_at, updated_at
       from organization_provider_credentials
       where organization_id = $1`,
      [organizationId],
    );
    return rows.map(mapCredentialMetadata);
  }

  async getProviderEncryptedKey(
    organizationId: string,
    providerSlug: ProviderSlug,
  ): Promise<string | null> {
    const { rows } = await this.query(
      `select encrypted_api_key from organization_provider_credentials
       where organization_id = $1 and provider_slug = $2`,
      [organizationId, providerSlug],
    );
    return rows[0]?.encrypted_api_key ?? null;
  }

  async saveProviderCredential(
    input: SaveProviderCredentialInput,
  ): Promise<ProviderCredentialMetadata> {
    const { rows } = await this.query(
      `insert into organization_provider_credentials
         (organization_id, provider_slug, credential_mode, encrypted_api_key, key_last_four,
          status, created_by_user_id, updated_by_user_id)
       values ($1, $2, $3, $4, $5, $6, $7, $7)
       on conflict (organization_id, provider_slug) do update set
         credential_mode = excluded.credential_mode,
         encrypted_api_key = coalesce(excluded.encrypted_api_key, organization_provider_credentials.encrypted_api_key),
         key_last_four = coalesce(excluded.key_last_four, organization_provider_credentials.key_last_four),
         status = excluded.status,
         updated_by_user_id = excluded.updated_by_user_id,
         updated_at = now()
       returning id, organization_id, provider_slug, credential_mode, key_last_four, status,
                 created_by_user_id, updated_by_user_id, created_at, updated_at`,
      [
        input.organizationId,
        input.providerSlug,
        input.credentialMode,
        input.encryptedApiKey ?? null,
        input.keyLastFour ?? null,
        input.status ?? "active",
        input.userId ?? null,
      ],
    );
    return mapCredentialMetadata(rows[0]);
  }

  async disableProviderCredential(
    organizationId: string,
    providerSlug: ProviderSlug,
    userId?: string | null,
  ): Promise<ProviderCredentialMetadata | null> {
    const { rows } = await this.query(
      `update organization_provider_credentials set
         credential_mode = 'disabled',
         status = 'disabled',
         encrypted_api_key = null,
         key_last_four = null,
         updated_by_user_id = $3,
         updated_at = now()
       where organization_id = $1 and provider_slug = $2
       returning id, organization_id, provider_slug, credential_mode, key_last_four, status,
                 created_by_user_id, updated_by_user_id, created_at, updated_at`,
      [organizationId, providerSlug, userId ?? null],
    );
    return rows[0] ? mapCredentialMetadata(rows[0]) : null;
  }

  async listLlmUsageEvents(organizationId: string, limit = 50): Promise<LlmUsageEvent[]> {
    const { rows } = await this.query(
      `select * from llm_usage_events
       where organization_id = $1
       order by created_at desc
       limit $2`,
      [organizationId, limit],
    );
    return rows.map(mapUsageEvent);
  }

  async createLlmUsageEvent(input: CreateLlmUsageEventInput): Promise<LlmUsageEvent> {
    const { rows } = await this.query(
      `insert into llm_usage_events
         (organization_id, employee_id, provider_slug, model_id, task_type, input_tokens,
          cached_input_tokens, output_tokens, estimated_cost_usd, latency_ms, status,
          error_code, request_id_hash, created_by_user_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       returning *`,
      [
        input.organizationId,
        input.employeeId ?? null,
        input.providerSlug,
        input.modelId,
        input.taskType,
        input.inputTokens,
        input.cachedInputTokens ?? 0,
        input.outputTokens,
        input.estimatedCostUsd ?? null,
        input.latencyMs ?? null,
        input.status,
        input.errorCode ?? null,
        input.requestIdHash ?? null,
        input.createdByUserId ?? null,
      ],
    );
    return mapUsageEvent(rows[0]);
  }

  async getModelHubOverview(organizationId: string): Promise<ModelHubOverview> {
    const settings = await this.getOrganizationModelSettings(organizationId);
    const [{ rows: countRows }, { rows: spendRows }, recent, configured] = await Promise.all([
      this.query("select count(*)::int as n from llm_usage_events where organization_id = $1", [
        organizationId,
      ]),
      this.query(
        "select coalesce(sum(estimated_cost_usd), 0) as total from llm_usage_events where organization_id = $1",
        [organizationId],
      ),
      this.listLlmUsageEvents(organizationId, 10),
      this.query(
        "select count(*)::int as n from organization_provider_credentials where organization_id = $1 and status = 'active'",
        [organizationId],
      ),
    ]);
    return {
      defaultModelId: settings.defaultModelId,
      routingMode: settings.routingMode,
      monthlyBudgetUsd: settings.monthlyBudgetUsd,
      allowedProviderCount:
        settings.allowedProviderSlugs.length > 0
          ? settings.allowedProviderSlugs.length
          : MODEL_PROVIDERS.length - settings.blockedProviderSlugs.length,
      totalProviders: MODEL_PROVIDERS.length,
      configuredProviderCount: configured.rows[0]?.n ?? 0,
      usageEventCount: countRows[0]?.n ?? 0,
      estimatedSpendUsd: num(spendRows[0]?.total) ?? 0,
      recentUsage: recent,
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
