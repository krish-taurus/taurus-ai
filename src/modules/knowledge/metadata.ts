/**
 * Knowledge Vault metadata (Prompt 006).
 *
 * Plain, business-friendly labels plus the file-type allowlist and size limit.
 * Pure data with no server dependencies, so both server and client code may
 * import it. No technical retrieval terminology anywhere.
 */

import type {
  DocumentExtractionStatus,
  KnowledgeSourceStatus,
  KnowledgeSourceType,
  KnowledgeVisibility,
} from "@/lib/db/types";

export const KNOWLEDGE_SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  file: "Document",
  text: "Note",
  url: "Website",
};

export const KNOWLEDGE_STATUS_LABELS: Record<KnowledgeSourceStatus, string> = {
  draft: "Draft",
  uploaded: "Uploaded",
  processing: "Processing",
  ready: "Ready",
  failed: "Needs attention",
  archived: "Archived",
};

/** Status dot fill level (0 hollow … 3 solid) so status reads without color. */
export const KNOWLEDGE_STATUS_LEVEL: Record<KnowledgeSourceStatus, 0 | 1 | 2 | 3> = {
  ready: 3,
  uploaded: 2,
  processing: 2,
  draft: 1,
  failed: 1,
  archived: 0,
};

export const KNOWLEDGE_VISIBILITY_LABELS: Record<KnowledgeVisibility, string> = {
  private: "Private",
  organization: "Organization",
};

export const EXTRACTION_STATUS_LABELS: Record<DocumentExtractionStatus, string> = {
  not_required: "No text",
  pending: "Pending",
  extracted: "Text stored",
  failed: "Could not read text",
  unsupported: "Stored as document",
};

/** Message shown for uploaded PDF/DOCX documents (no parsing this sprint). */
export const PDF_DOCX_PROCESSING_MESSAGE =
  "This document has been added to the vault. Full document understanding will be available in a later step.";

/** Message shown for website URL records (no crawling this sprint). */
export const WEBSITE_RECORD_MESSAGE =
  "This website has been saved to the vault. Reading websites automatically is coming in a later step.";

// --- File upload rules ------------------------------------------------------

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export interface AllowedFileType {
  extension: string;
  /** Whether we extract and store text for this format in this sprint. */
  extractsText: boolean;
  label: string;
}

/** Allowed upload types. Text formats are extracted; pdf/docx are stored only. */
export const ALLOWED_FILE_TYPES: readonly AllowedFileType[] = [
  { extension: ".txt", extractsText: true, label: "Text" },
  { extension: ".md", extractsText: true, label: "Markdown" },
  { extension: ".csv", extractsText: true, label: "CSV" },
  { extension: ".json", extractsText: true, label: "JSON" },
  { extension: ".pdf", extractsText: false, label: "PDF" },
  { extension: ".docx", extractsText: false, label: "Word document" },
] as const;

export const ALLOWED_EXTENSIONS = ALLOWED_FILE_TYPES.map((t) => t.extension);

/** Returns the lower-cased extension (with dot) of a filename, or "". */
export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot).toLowerCase();
}

export function getAllowedFileType(filename: string): AllowedFileType | undefined {
  const ext = fileExtension(filename);
  return ALLOWED_FILE_TYPES.find((t) => t.extension === ext);
}

export function humanFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
