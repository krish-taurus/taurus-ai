/**
 * Assign knowledge to an AI Employee (Sprint 029). Server component: lists the
 * organization's vaults with an assign/remove control per vault. Assigning a
 * vault grants the employee every source in it (and anything added later).
 */

import Link from "next/link";
import type { KnowledgeVaultSummary } from "@/lib/db/types";
import { Card } from "@/components/ui";
import { AssignVaultButton } from "@/components/knowledge/assign-knowledge-button";

export function AssignKnowledgePanel({
  employeeId,
  vaults,
  assignedIds,
  canManage,
}: {
  employeeId: string;
  vaults: KnowledgeVaultSummary[];
  assignedIds: Set<string>;
  canManage: boolean;
}) {
  if (vaults.length === 0) {
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
        {vaults.map(({ vault, sourceCount, readyCount }) => {
          const assigned = assignedIds.has(vault.id);
          return (
            <li
              key={vault.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-taurus-text">
                    {vault.name}
                  </span>
                  {vault.isDefault ? (
                    <span className="text-xs text-taurus-faint">Default</span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-taurus-faint">
                  {sourceCount} {sourceCount === 1 ? "source" : "sources"} · {readyCount} ready
                </p>
              </div>

              {canManage ? (
                <AssignVaultButton employeeId={employeeId} vaultId={vault.id} assigned={assigned} />
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
