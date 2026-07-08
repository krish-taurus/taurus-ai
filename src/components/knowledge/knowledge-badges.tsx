/**
 * Knowledge Vault badges (Prompt 006). Monochrome; status uses a dot so it reads
 * without relying on color.
 */

import type {
  KnowledgeIndexingState,
  KnowledgeSourceStatus,
  KnowledgeSourceType,
} from "@/lib/db/types";
import {
  KNOWLEDGE_SOURCE_TYPE_LABELS,
  KNOWLEDGE_STATUS_LABELS,
  KNOWLEDGE_STATUS_LEVEL,
} from "@/modules/knowledge/metadata";
import { Badge, StatusDot } from "@/components/ui";

export function KnowledgeStatusBadge({ status }: { status: KnowledgeSourceStatus }) {
  return (
    <Badge tone={status === "archived" ? "outline" : "soft"}>
      <StatusDot level={KNOWLEDGE_STATUS_LEVEL[status]} />
      {KNOWLEDGE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function KnowledgeTypeBadge({ sourceType }: { sourceType: KnowledgeSourceType }) {
  return <Badge tone="outline">{KNOWLEDGE_SOURCE_TYPE_LABELS[sourceType]}</Badge>;
}

const INDEXING_LABELS: Record<KnowledgeIndexingState, string> = {
  pending: "Not indexed",
  indexing: "Indexing…",
  ready: "Ready to search",
  failed: "Indexing failed",
};
const INDEXING_LEVEL: Record<KnowledgeIndexingState, 0 | 1 | 2 | 3> = {
  pending: 1,
  indexing: 2,
  ready: 3,
  failed: 0,
};

/** Search-indexing state so a manager knows when a source is searchable (Sprint 019). */
export function KnowledgeIndexingBadge({ state }: { state: KnowledgeIndexingState }) {
  return (
    <Badge tone={state === "ready" ? "soft" : "outline"}>
      <StatusDot level={INDEXING_LEVEL[state]} />
      {INDEXING_LABELS[state]}
    </Badge>
  );
}
