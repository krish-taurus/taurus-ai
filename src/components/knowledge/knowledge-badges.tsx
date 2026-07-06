/**
 * Knowledge Vault badges (Prompt 006). Monochrome; status uses a dot so it reads
 * without relying on color.
 */

import type { KnowledgeSourceStatus, KnowledgeSourceType } from "@/lib/db/types";
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
