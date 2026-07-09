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
  database: "Database",
  google_drive: "Google Drive",
  cloud_storage: "Cloud storage",
  sharepoint: "SharePoint / OneDrive",
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

/** Shown for a document whose text could not be read (e.g. a scanned PDF). */
export const PDF_DOCX_PROCESSING_MESSAGE =
  "This document was added, but its text could not be read (it may be scanned or image-only). Try a text-based PDF or a Word document.";

/** Shown when a website could not be read (unreachable or blocked). */
export const WEBSITE_RECORD_MESSAGE =
  "This website was saved, but its content could not be read. Check the address is public and reachable.";

// --- File upload rules ------------------------------------------------------

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export interface AllowedFileType {
  extension: string;
  /** Whether we extract and store text for this format in this sprint. */
  extractsText: boolean;
  label: string;
}

/** Allowed upload types. Text, PDF, and DOCX all have their text extracted. */
export const ALLOWED_FILE_TYPES: readonly AllowedFileType[] = [
  { extension: ".txt", extractsText: true, label: "Text" },
  { extension: ".md", extractsText: true, label: "Markdown" },
  { extension: ".csv", extractsText: true, label: "CSV" },
  { extension: ".json", extractsText: true, label: "JSON" },
  { extension: ".pdf", extractsText: true, label: "PDF" },
  { extension: ".docx", extractsText: true, label: "Word document" },
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
