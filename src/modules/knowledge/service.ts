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

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
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

/** Flow C: create a website URL record (URL is stored, never fetched). */
export async function createUrlSource(
  store: DataStore,
  actor: KnowledgeActor,
  input: unknown,
): Promise<KnowledgeSource> {
  const parsed = createUrlSourceSchema.safeParse(input);
  if (!parsed.success) {
    throw new KnowledgeValidationError(firstIssueMessage(parsed.error, "Invalid website address."));
  }
  const values = parsed.data;

  const source = await store.createKnowledgeSource({
    organizationId: actor.organizationId,
    name: values.name,
    description: emptyToNull(values.description),
    sourceType: "url",
    status: "uploaded",
    visibility: values.visibility,
    metadata: { url: values.url },
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

/** Flow B: create a file knowledge source, storing the file via the adapter. */
export async function createFileSource(
  store: DataStore,
  storage: KnowledgeStorage,
  actor: KnowledgeActor,
  input: { meta: unknown; file: UploadedFile },
): Promise<KnowledgeSource> {
  const parsedMeta = createFileSourceMetaSchema.safeParse(input.meta);
  if (!parsedMeta.success) {
    throw new KnowledgeValidationError(firstIssueMessage(parsedMeta.error, "Invalid details."));
  }
  const meta = parsedMeta.data;
  const fileType = validateUpload(input.file);

  const checksum = await sha256Hex(input.file.bytes);
  const storageKey = buildStorageKey(fileType.extension);
  const displayName = sanitizeFilename(input.file.originalFilename);

  // Persist the bytes first; if this fails, we never create dangling records.
  await storage.save({
    organizationId: actor.organizationId,
    storageKey,
    bytes: input.file.bytes,
  });

  const extractsText = fileType.extractsText;
  const textContent = extractsText ? decodeUtf8(input.file.bytes) : null;

  const source = await store.createKnowledgeSource({
    organizationId: actor.organizationId,
    name: meta.name,
    description: emptyToNull(meta.description),
    sourceType: "file",
    status: extractsText ? "ready" : "uploaded",
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
    extractionStatus: extractsText ? "extracted" : "unsupported",
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
