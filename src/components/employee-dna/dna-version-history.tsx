/**
 * Employee DNA version history + status badge (Prompt 005; restyled 005B).
 *
 * Lists every DNA version newest-first. Managers can archive non-archived
 * versions via a server action. Monochrome, with a status dot so state reads
 * without color.
 */

import { formatDate } from "@/lib/format";
import type { DnaStatus, EmployeeDnaVersion } from "@/lib/db/types";
import { archiveDnaVersionAction } from "@/modules/employee-dna/actions";
import { Badge, Card, StatusDot } from "@/components/ui";

export const DNA_STATUS_LABELS: Record<DnaStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const DNA_STATUS_LEVEL: Record<DnaStatus, 0 | 1 | 2 | 3> = {
  published: 3,
  draft: 1,
  archived: 0,
};

export function DnaStatusBadge({ status }: { status: DnaStatus }) {
  return (
    <Badge tone={status === "published" ? "soft" : "outline"}>
      <StatusDot level={DNA_STATUS_LEVEL[status]} />
      {DNA_STATUS_LABELS[status]}
    </Badge>
  );
}

export function DnaVersionHistory({
  versions,
  employeeId,
  canManage,
}: {
  versions: EmployeeDnaVersion[];
  employeeId: string;
  canManage: boolean;
}) {
  if (versions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-taurus-strong bg-taurus-surface p-5 text-sm text-taurus-faint">
        No versions yet. Save a draft to create Version 1.
      </div>
    );
  }

  return (
    <Card className="divide-y divide-taurus-line overflow-hidden p-0">
      <ul>
        {versions.map((version) => (
          <li
            key={version.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-taurus-text">
                Version {version.versionNumber}
              </span>
              <DnaStatusBadge status={version.status} />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-taurus-faint">
                Updated {formatDate(version.updatedAt)}
              </span>
              {canManage && version.status !== "archived" ? (
                <form action={archiveDnaVersionAction}>
                  <input type="hidden" name="employeeId" value={employeeId} />
                  <input type="hidden" name="versionId" value={version.id} />
                  <button
                    type="submit"
                    className="text-xs font-medium text-taurus-faint transition-colors hover:text-taurus-text"
                  >
                    Archive
                  </button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
