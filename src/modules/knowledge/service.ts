/**
 * Knowledge Vault service (Prompt 006).
 *
 * Pure domain logic over a DataStore (and, for uploads, a small storage-adapter
 * interface) so it is unit-testable without a filesystem. Validates input,
 * persists sources/documents/assignments, and writes audit events.
 *
 * AUDIT: only non-sensitive metadata is recorded — never text content or file
 * bytes. Organization scoping is enforced on every read/write; callers (server
 * actions) resolve the organization and check permissions first.
 */

import type { DataStore } from "@/lib/db/store";
import type {
  DocumentExtractionStatus,
  EmployeeKnowledgeAssignment,
  KnowledgeSource,
  KnowledgeVaultOverview,
} from "@/lib/db/types";
import {
  ALLOWED_EXTENSIONS,
  getAllowedFileType,
  MAX_UPLOAD_BYTES,
  type AllowedFileType,
} from "@/modules/knowledge/metadata";
import {
  createFileSourceMetaSchema,
  createTextSourceSchema,
  createUrlSourceSchema,
  updateKnowledgeSourceSchema,
} from "@/modules/knowledge/schema";
import { assertCanAddKnowledgeSource } from "@/modules/billing/service";

/** Minimal storage seam so the service can be tested without a real filesystem. */
export interface KnowledgeStorage {
  save(input: { organizationId: string; storageKey: string; bytes: Uint8Array }): Promise<void>;
}

export interface KnowledgeActor {
  organizationId: string;
  userId: string;
}

export interface UploadedFile {
  originalFilename: string;
  contentType: string | null;
  bytes: Uint8Array;
}

export class KnowledgeValidationError extends Error {
  constructor(message = "Please review the details and try again.") {
    super(message);
    this.name = "KnowledgeValidationError";
  }
}

export class KnowledgeNotFoundError extends Error {
  constructor(message = "This knowledge source could not be found.") {
    super(message);
    this.name = "KnowledgeNotFoundError";
  }
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function firstIssueMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues?: Array<{ message?: string }> }).issues;
    return issues?.[0]?.message ?? fallback;
  }
  return fallback;
}

// --- Upload validation (exposed for tests) ---------------------------------

/** Validate an uploaded file's type/size/emptiness; returns the allowed type. */
export function validateUpload(file: UploadedFile): AllowedFileType {
  if (file.bytes.byteLength === 0) {
    throw new KnowledgeValidationError("This file is empty. Please choose a file with content.");
  }
  if (file.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new KnowledgeValidationError(
      `This file is too large. The maximum size is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
    );
  }
  const type = getAllowedFileType(file.originalFilename);
  if (!type) {
    throw new KnowledgeValidationError(
      `This file type is not supported. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}.`,
    );
  }
  return type;
}

// --- Text extraction helpers (pure) ----------------------------------------

/**
 * Pre-computed extraction result, produced by the server-only extraction module
 * and passed in by the caller. Keeping it as a plain shape lets this service stay
 * pure and unit-testable (no PDF/DOCX/network dependencies).
 */
export interface ExtractionInput {
  text: string | null;
  status: DocumentExtractionStatus;
}

function makePreview(text: string, max = 600): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/^.*[\\/]/, "");
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[._]+/, "")
    .slice(0, 120);
  return cleaned || "document";
}

function buildStorageKey(extension: string): string {
  const ext = /^\.[a-z0-9]{1,8}$/.test(extension.toLowerCase()) ? extension.toLowerCase() : "";
  return `${globalThis.crypto.randomUUID()}${ext}`;
}

// --- Creation flows ---------------------------------------------------------

/** Flow A: create a manual-text knowledge source (stored + ready). */
export async function createTextSource(
  store: DataStore,
  actor: KnowledgeActor,
  input: unknown,
): Promise<KnowledgeSource> {
  const parsed = createTextSourceSchema.safeParse(input);
  if (!parsed.success) {
    throw new KnowledgeValidationError(firstIssueMessage(parsed.error, "Invalid knowledge."));
  }
  const values = parsed.data;

  // Entitlement gate (Sprint 015): block past the plan's Knowledge Vault cap.
  await assertCanAddKnowledgeSource(store, actor.organizationId);

  const source = await store.createKnowledgeSource({
    organizationId: actor.organizationId,
    name: values.name,
    description: emptyToNull(values.description),
    sourceType: "text",
    status: "ready",
    visibility: values.visibility,
    createdByUserId: actor.userId,
  });

  await store.createKnowledgeDocument({
    organizationId: actor.organizationId,
    knowledgeSourceId: source.id,
    title: values.name,
    textContent: values.text,
    textPreview: makePreview(values.text),
    extractionStatus: "extracted",
    createdByUserId: actor.userId,
  });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "knowledge_source.created",
    targetType: "knowledge_source",
    targetId: source.id,
    metadata: { sourceId: source.id, sourceType: source.sourceType, status: source.status },
  });

  return source;
}

/**
 * Flow C: create a website knowledge source. The caller fetches the page text
 * (SSRF-guarded, server-only) and passes it in; the URL is stored and, when the
 * page was read, its text is saved as a document so AI Employees can answer from
 * it. If the fetch failed, the record is still saved and flagged for attention.
 */
export async function createUrlSource(
  store: DataStore,
  actor: KnowledgeActor,
  input: unknown,
  fetched: ExtractionInput,
): Promise<KnowledgeSource> {
  const parsed = createUrlSourceSchema.safeParse(input);
  if (!parsed.success) {
    throw new KnowledgeValidationError(firstIssueMessage(parsed.error, "Invalid website address."));
  }
  const values = parsed.data;

  // Entitlement gate (Sprint 015): block past the plan's Knowledge Vault cap.
  await assertCanAddKnowledgeSource(store, actor.organizationId);

  const readable = fetched.status === "extracted" && !!fetched.text;

  const source = await store.createKnowledgeSource({
    organizationId: actor.organizationId,
    name: values.name,
    description: emptyToNull(values.description),
    sourceType: "url",
    status: readable ? "ready" : "failed",
    visibility: values.visibility,
    metadata: { url: values.url },
    createdByUserId: actor.userId,
  });

  await store.createKnowledgeDocument({
    organizationId: actor.organizationId,
    knowledgeSourceId: source.id,
    title: values.name,
    contentType: "text/html",
    textContent: fetched.text,
    textPreview: fetched.text ? makePreview(fetched.text) : null,
    extractionStatus: fetched.status,
    createdByUserId: actor.userId,
  });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "knowledge_source.created",
    targetType: "knowledge_source",
    targetId: source.id,
    metadata: { sourceId: source.id, sourceType: source.sourceType, status: source.status },
  });

  return source;
}

/** Non-secret + encrypted connector config stored on a database source. */
export interface DatabaseConnectorMeta {
  kind: "postgres" | "mysql";
  /** Host shown in the UI (never the full connection string). */
  displayHost: string;
  query: string;
  /** Encrypted connection string (ciphertext only — never plaintext). */
  connectionEncrypted: string;
}

/**
 * Flow D: create a database knowledge source. The caller (server action) runs the
 * read-only query and encrypts the connection string, then passes the results in;
 * the query output is stored as a searchable document. Pure + testable.
 */
export async function createDatabaseSource(
  store: DataStore,
  actor: KnowledgeActor,
  input: {
    meta: unknown;
    connector: DatabaseConnectorMeta;
    result: ExtractionInput & { rowCount: number };
  },
): Promise<KnowledgeSource> {
  const parsedMeta = createFileSourceMetaSchema.safeParse(input.meta);
  if (!parsedMeta.success) {
    throw new KnowledgeValidationError(firstIssueMessage(parsedMeta.error, "Invalid details."));
  }
  const meta = parsedMeta.data;

  await assertCanAddKnowledgeSource(store, actor.organizationId);

  const readable = input.result.status === "extracted" && !!input.result.text;

  const source = await store.createKnowledgeSource({
    organizationId: actor.organizationId,
    name: meta.name,
    description: emptyToNull(meta.description),
    sourceType: "database",
    status: readable ? "ready" : "failed",
    visibility: meta.visibility,
    metadata: {
      kind: input.connector.kind,
      displayHost: input.connector.displayHost,
      query: input.connector.query,
      connectionEncrypted: input.connector.connectionEncrypted,
      rowCount: input.result.rowCount,
    },
    createdByUserId: actor.userId,
  });

  await store.createKnowledgeDocument({
    organizationId: actor.organizationId,
    knowledgeSourceId: source.id,
    title: meta.name,
    contentType: "text/plain",
    textContent: input.result.text,
    textPreview: input.result.text ? makePreview(input.result.text) : null,
    extractionStatus: input.result.status,
    createdByUserId: actor.userId,
  });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "knowledge_source.created",
    targetType: "knowledge_source",
    targetId: source.id,
    metadata: { sourceId: source.id, sourceType: source.sourceType, status: source.status },
  });

  return source;
}

/** Re-run a database source's query: replace its document with fresh results. */
export async function syncDatabaseSource(
  store: DataStore,
  actor: KnowledgeActor,
  sourceId: string,
  result: ExtractionInput & { rowCount: number },
): Promise<KnowledgeSource> {
  const existing = await store.getKnowledgeSource(actor.organizationId, sourceId);
  if (!existing || existing.sourceType !== "database") throw new KnowledgeNotFoundError();

  const readable = result.status === "extracted" && !!result.text;

  await store.deleteKnowledgeDocumentsForSource(actor.organizationId, sourceId);
  await store.createKnowledgeDocument({
    organizationId: actor.organizationId,
    knowledgeSourceId: sourceId,
    title: existing.name,
    contentType: "text/plain",
    textContent: result.text,
    textPreview: result.text ? makePreview(result.text) : null,
    extractionStatus: result.status,
    createdByUserId: actor.userId,
  });

  const updated =
    (await store.updateKnowledgeSource(actor.organizationId, sourceId, {
      status: readable ? "ready" : "failed",
    })) ?? existing;

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "knowledge_source.synced",
    targetType: "knowledge_source",
    targetId: sourceId,
    metadata: { sourceId, sourceType: "database", rowCount: result.rowCount, status: updated.status },
  });

  return updated;
}

/** Non-secret + encrypted connector config stored on a Google Drive source. */
export interface GoogleDriveConnectorMeta {
  /** Connected account email, shown in the UI (never a token). */
  email: string | null;
  /** Drive file/folder id this source ingests. */
  rootId: string;
  /** Display name of the Drive file/folder. */
  rootName: string;
  /** Encrypted refresh token (ciphertext only — never plaintext). */
  connectionEncrypted: string;
}

/** One extracted connector file → a knowledge document. */
export interface ConnectorDocumentInput {
  title: string;
  text: string | null;
  status: DocumentExtractionStatus;
}

/** Back-compat alias. */
export type GoogleDriveDocumentInput = ConnectorDocumentInput;

function statusForDocuments(documents: ConnectorDocumentInput[]): "ready" | "failed" {
  return documents.some((d) => d.status === "extracted" && !!d.text) ? "ready" : "failed";
}

async function writeConnectorDocuments(
  store: DataStore,
  actor: KnowledgeActor,
  sourceId: string,
  documents: ConnectorDocumentInput[],
): Promise<void> {
  for (const doc of documents) {
    await store.createKnowledgeDocument({
      organizationId: actor.organizationId,
      knowledgeSourceId: sourceId,
      title: doc.title,
      contentType: "text/plain",
      textContent: doc.text,
      textPreview: doc.text ? makePreview(doc.text) : null,
      extractionStatus: doc.status,
      createdByUserId: actor.userId,
    });
  }
}

/**
 * Flow E: create a Google Drive knowledge source. The caller (server action) runs
 * the OAuth-authenticated Drive read + extraction and encrypts the refresh token,
 * then passes the results in; each file becomes a searchable document. Pure + testable.
 */
export async function createGoogleDriveSource(
  store: DataStore,
  actor: KnowledgeActor,
  input: {
    meta: unknown;
    connector: GoogleDriveConnectorMeta;
    documents: GoogleDriveDocumentInput[];
    skipped: number;
  },
): Promise<KnowledgeSource> {
  const parsedMeta = createFileSourceMetaSchema.safeParse(input.meta);
  if (!parsedMeta.success) {
    throw new KnowledgeValidationError(firstIssueMessage(parsedMeta.error, "Invalid details."));
  }
  const meta = parsedMeta.data;

  await assertCanAddKnowledgeSource(store, actor.organizationId);

  const status = statusForDocuments(input.documents);

  const source = await store.createKnowledgeSource({
    organizationId: actor.organizationId,
    name: meta.name,
    description: emptyToNull(meta.description),
    sourceType: "google_drive",
    status,
    visibility: meta.visibility,
    metadata: {
      email: input.connector.email,
      rootId: input.connector.rootId,
      rootName: input.connector.rootName,
      connectionEncrypted: input.connector.connectionEncrypted,
      fileCount: input.documents.length,
      skipped: input.skipped,
    },
    createdByUserId: actor.userId,
  });

  await writeConnectorDocuments(store, actor, source.id, input.documents);

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "knowledge_source.created",
    targetType: "knowledge_source",
    targetId: source.id,
    metadata: { sourceId: source.id, sourceType: source.sourceType, status: source.status },
  });

  return source;
}

/** Re-run a Google Drive source's read: replace its documents with fresh files. */
export async function syncGoogleDriveSource(
  store: DataStore,
  actor: KnowledgeActor,
  sourceId: string,
  input: { documents: GoogleDriveDocumentInput[]; skipped: number },
): Promise<KnowledgeSource> {
  const existing = await store.getKnowledgeSource(actor.organizationId, sourceId);
  if (!existing || existing.sourceType !== "google_drive") throw new KnowledgeNotFoundError();

  const status = statusForDocuments(input.documents);

  await store.deleteKnowledgeDocumentsForSource(actor.organizationId, sourceId);
  await writeConnectorDocuments(store, actor, sourceId, input.documents);

  const updated =
    (await store.updateKnowledgeSource(actor.organizationId, sourceId, { status })) ?? existing;

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "knowledge_source.synced",
    targetType: "knowledge_source",
    targetId: sourceId,
    metadata: {
      sourceId,
      sourceType: "google_drive",
      fileCount: input.documents.length,
      status: updated.status,
    },
  });

  return updated;
}

/** Non-secret + encrypted connector config stored on a cloud storage source. */
export interface CloudStorageConnectorMeta {
  provider: "azure_blob" | "gcs";
  /** account/container (Azure) or bucket (GCS), for display. */
  displayName: string;
  /** Optional path prefix that scopes the import. */
  prefix: string | null;
  /** Bucket name (GCS only) — needed to re-sync. */
  bucket: string | null;
  /** Encrypted credential (SAS URL or service-account JSON — ciphertext only). */
  connectionEncrypted: string;
}

/**
 * Flow F: create a cloud storage knowledge source. The caller (server action)
 * lists + downloads + extracts the objects and encrypts the credential, then
 * passes the results in; each file becomes a searchable document. Pure + testable.
 */
export async function createCloudStorageSource(
  store: DataStore,
  actor: KnowledgeActor,
  input: {
    meta: unknown;
    connector: CloudStorageConnectorMeta;
    documents: ConnectorDocumentInput[];
    skipped: number;
  },
): Promise<KnowledgeSource> {
  const parsedMeta = createFileSourceMetaSchema.safeParse(input.meta);
  if (!parsedMeta.success) {
    throw new KnowledgeValidationError(firstIssueMessage(parsedMeta.error, "Invalid details."));
  }
  const meta = parsedMeta.data;

  await assertCanAddKnowledgeSource(store, actor.organizationId);

  const status = statusForDocuments(input.documents);

  const source = await store.createKnowledgeSource({
    organizationId: actor.organizationId,
    name: meta.name,
    description: emptyToNull(meta.description),
    sourceType: "cloud_storage",
    status,
    visibility: meta.visibility,
    metadata: {
      provider: input.connector.provider,
      displayName: input.connector.displayName,
      prefix: input.connector.prefix,
      bucket: input.connector.bucket,
      connectionEncrypted: input.connector.connectionEncrypted,
      fileCount: input.documents.length,
      skipped: input.skipped,
    },
    createdByUserId: actor.userId,
  });

  await writeConnectorDocuments(store, actor, source.id, input.documents);

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "knowledge_source.created",
    targetType: "knowledge_source",
    targetId: source.id,
    metadata: { sourceId: source.id, sourceType: source.sourceType, status: source.status },
  });

  return source;
}

/** Re-run a cloud storage source's read: replace its documents with fresh files. */
export async function syncCloudStorageSource(
  store: DataStore,
  actor: KnowledgeActor,
  sourceId: string,
  input: { documents: ConnectorDocumentInput[]; skipped: number },
): Promise<KnowledgeSource> {
  const existing = await store.getKnowledgeSource(actor.organizationId, sourceId);
  if (!existing || existing.sourceType !== "cloud_storage") throw new KnowledgeNotFoundError();

  const status = statusForDocuments(input.documents);

  await store.deleteKnowledgeDocumentsForSource(actor.organizationId, sourceId);
  await writeConnectorDocuments(store, actor, sourceId, input.documents);

  const updated =
    (await store.updateKnowledgeSource(actor.organizationId, sourceId, { status })) ?? existing;

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "knowledge_source.synced",
    targetType: "knowledge_source",
    targetId: sourceId,
    metadata: {
      sourceId,
      sourceType: "cloud_storage",
      fileCount: input.documents.length,
      status: updated.status,
    },
  });

  return updated;
}

/** Flow B: create a file knowledge source, storing the file via the adapter. */
export async function createFileSource(
  store: DataStore,
  storage: KnowledgeStorage,
  actor: KnowledgeActor,
  input: { meta: unknown; file: UploadedFile; extraction: ExtractionInput },
): Promise<KnowledgeSource> {
  const parsedMeta = createFileSourceMetaSchema.safeParse(input.meta);
  if (!parsedMeta.success) {
    throw new KnowledgeValidationError(firstIssueMessage(parsedMeta.error, "Invalid details."));
  }
  const meta = parsedMeta.data;
  const fileType = validateUpload(input.file);

  // Entitlement gate (Sprint 015): block past the plan's Knowledge Vault cap.
  await assertCanAddKnowledgeSource(store, actor.organizationId);

  const checksum = await sha256Hex(input.file.bytes);
  const storageKey = buildStorageKey(fileType.extension);
  const displayName = sanitizeFilename(input.file.originalFilename);

  // Persist the bytes first; if this fails, we never create dangling records.
  await storage.save({
    organizationId: actor.organizationId,
    storageKey,
    bytes: input.file.bytes,
  });

  const textContent = input.extraction.text;
  const readable = input.extraction.status === "extracted" && !!textContent;

  const source = await store.createKnowledgeSource({
    organizationId: actor.organizationId,
    name: meta.name,
    description: emptyToNull(meta.description),
    sourceType: "file",
    status: readable ? "ready" : "uploaded",
    visibility: meta.visibility,
    metadata: { fileType: fileType.extension },
    createdByUserId: actor.userId,
  });

  const document = await store.createKnowledgeDocument({
    organizationId: actor.organizationId,
    knowledgeSourceId: source.id,
    title: displayName,
    originalFilename: displayName,
    contentType: input.file.contentType,
    byteSize: input.file.bytes.byteLength,
    checksumSha256: checksum,
    storageKey,
    textContent,
    textPreview: textContent ? makePreview(textContent) : null,
    extractionStatus: input.extraction.status,
    createdByUserId: actor.userId,
  });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "knowledge_source.created",
    targetType: "knowledge_source",
    targetId: source.id,
    metadata: { sourceId: source.id, sourceType: source.sourceType, status: source.status },
  });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "knowledge_document.uploaded",
    targetType: "knowledge_document",
    targetId: document.id,
    // Metadata only — never the file's text/bytes.
    metadata: {
      sourceId: source.id,
      documentId: document.id,
      sourceType: source.sourceType,
      fileSize: document.byteSize,
      contentType: document.contentType,
      status: source.status,
    },
  });

  return source;
}

// --- Update / archive -------------------------------------------------------

export async function updateSourceMetadata(
  store: DataStore,
  actor: KnowledgeActor,
  sourceId: string,
  input: unknown,
): Promise<KnowledgeSource> {
  const parsed = updateKnowledgeSourceSchema.safeParse(input);
  if (!parsed.success) {
    throw new KnowledgeValidationError(firstIssueMessage(parsed.error, "Invalid details."));
  }
  const existing = await store.getKnowledgeSource(actor.organizationId, sourceId);
  if (!existing) throw new KnowledgeNotFoundError();

  const updated = await store.updateKnowledgeSource(actor.organizationId, sourceId, {
    name: parsed.data.name,
    description: emptyToNull(parsed.data.description),
    visibility: parsed.data.visibility,
  });
  if (!updated) throw new KnowledgeNotFoundError();

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "knowledge_source.updated",
    targetType: "knowledge_source",
    targetId: updated.id,
    metadata: { sourceId: updated.id, sourceType: updated.sourceType, status: updated.status },
  });

  return updated;
}

export async function archiveSource(
  store: DataStore,
  actor: KnowledgeActor,
  sourceId: string,
): Promise<KnowledgeSource> {
  const archived = await store.archiveKnowledgeSource(actor.organizationId, sourceId);
  if (!archived) throw new KnowledgeNotFoundError();

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "knowledge_source.archived",
    targetType: "knowledge_source",
    targetId: archived.id,
    metadata: { sourceId: archived.id, sourceType: archived.sourceType, status: archived.status },
  });

  return archived;
}

// --- Assignment -------------------------------------------------------------

export async function assignKnowledgeToEmployee(
  store: DataStore,
  actor: KnowledgeActor,
  input: { employeeId: string; knowledgeSourceId: string },
): Promise<EmployeeKnowledgeAssignment> {
  // Both the employee and the source must belong to the actor's organization.
  const source = await store.getKnowledgeSource(actor.organizationId, input.knowledgeSourceId);
  if (!source) throw new KnowledgeNotFoundError();
  const employee = await store.getEmployee(actor.organizationId, input.employeeId);
  if (!employee) throw new KnowledgeNotFoundError("This AI Employee could not be found.");

  const assignment = await store.assignKnowledgeSourceToEmployee({
    organizationId: actor.organizationId,
    employeeId: input.employeeId,
    knowledgeSourceId: input.knowledgeSourceId,
    assignedByUserId: actor.userId,
  });

  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "knowledge_source.assigned_to_employee",
    targetType: "knowledge_source",
    targetId: source.id,
    metadata: { sourceId: source.id, employeeId: input.employeeId, sourceType: source.sourceType },
  });

  return assignment;
}

export async function unassignKnowledgeFromEmployee(
  store: DataStore,
  actor: KnowledgeActor,
  input: { employeeId: string; knowledgeSourceId: string },
): Promise<boolean> {
  const removed = await store.unassignKnowledgeSourceFromEmployee(
    actor.organizationId,
    input.employeeId,
    input.knowledgeSourceId,
  );

  if (removed) {
    await store.createAuditEvent({
      organizationId: actor.organizationId,
      actorType: "user",
      actorId: actor.userId,
      action: "knowledge_source.unassigned_from_employee",
      targetType: "knowledge_source",
      targetId: input.knowledgeSourceId,
      metadata: { sourceId: input.knowledgeSourceId, employeeId: input.employeeId },
    });
  }

  return removed;
}

export function getVaultOverview(
  store: DataStore,
  organizationId: string,
): Promise<KnowledgeVaultOverview> {
  return store.getKnowledgeVaultOverview(organizationId);
}
