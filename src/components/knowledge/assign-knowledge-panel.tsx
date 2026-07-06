/**
 * Assign knowledge to an AI Employee (Prompt 006). Server component: lists the
 * organization's knowledge sources with an assign/remove control per source.
 */

import Link from "next/link";
import type { KnowledgeSource } from "@/lib/db/types";
import { buttonClasses, Card } from "@/components/ui";
import { KnowledgeStatusBadge, KnowledgeTypeBadge } from "@/components/knowledge/knowledge-badges";
import { assignKnowledgeAction, unassignKnowledgeAction } from "@/modules/knowledge/actions";

export function AssignKnowledgePanel({
  employeeId,
  sources,
  assignedIds,
  canManage,
}: {
  employeeId: string;
  sources: KnowledgeSource[];
  assignedIds: Set<string>;
  canManage: boolean;
}) {
  if (sources.length === 0) {
    return (
      <Card className="p-6 text-sm text-taurus-sub">
        Your Knowledge Vault is empty.{" "}
        <Link
          href="/dashboard/knowledge/new"
          className="font-medium text-taurus-text hover:underline"
        >
          Add knowledge
        </Link>{" "}
        to assign it here.
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-taurus-line overflow-hidden p-0">
      <ul>
        {sources.map((source) => {
          const assigned = assignedIds.has(source.id);
          return (
            <li
              key={source.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/dashboard/knowledge/${source.id}`}
                  className="truncate text-sm font-medium text-taurus-text hover:underline"
                >
                  {source.name}
                </Link>
                <div className="mt-1.5 flex items-center gap-2">
                  <KnowledgeTypeBadge sourceType={source.sourceType} />
                  <KnowledgeStatusBadge status={source.status} />
                </div>
              </div>

              {canManage ? (
                assigned ? (
                  <form action={unassignKnowledgeAction}>
                    <input type="hidden" name="employeeId" value={employeeId} />
                    <input type="hidden" name="knowledgeSourceId" value={source.id} />
                    <button type="submit" className={buttonClasses("outline", "sm")}>
                      Remove
                    </button>
                  </form>
                ) : (
                  <form action={assignKnowledgeAction}>
                    <input type="hidden" name="employeeId" value={employeeId} />
                    <input type="hidden" name="knowledgeSourceId" value={source.id} />
                    <button type="submit" className={buttonClasses("secondary", "sm")}>
                      Assign
                    </button>
                  </form>
                )
              ) : (
                <span className="text-xs text-taurus-faint">
                  {assigned ? "Assigned" : "Not assigned"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
