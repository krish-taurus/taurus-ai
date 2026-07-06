/**
 * Knowledge source card (Prompt 006). Premium, monochrome, links to detail.
 */

import Link from "next/link";
import type { KnowledgeSource } from "@/lib/db/types";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui";
import { KnowledgeStatusBadge, KnowledgeTypeBadge } from "@/components/knowledge/knowledge-badges";

export function KnowledgeSourceCard({ source }: { source: KnowledgeSource }) {
  return (
    <Link href={`/dashboard/knowledge/${source.id}`} className="group block rounded-xl">
      <Card hover className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate text-base font-semibold text-taurus-text">
            {source.name}
          </h3>
          <KnowledgeTypeBadge sourceType={source.sourceType} />
        </div>

        {source.description ? (
          <p className="mt-2 line-clamp-2 text-sm text-taurus-sub">{source.description}</p>
        ) : (
          <p className="mt-2 text-sm text-taurus-faint">No description</p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <KnowledgeStatusBadge status={source.status} />
          <span className="text-xs text-taurus-faint">Updated {formatDate(source.updatedAt)}</span>
        </div>
      </Card>
    </Link>
  );
}
