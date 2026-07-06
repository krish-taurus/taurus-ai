/**
 * Employee DNA version history (Prompt 005). Server component.
 *
 * Lists every DNA version newest-first. Managers can archive non-archived
 * versions via a server action.
 */

import { formatDate } from "@/lib/format";
import type { DnaStatus, EmployeeDnaVersion } from "@/lib/db/types";
import { archiveDnaVersionAction } from "@/modules/employee-dna/actions";

export const DNA_STATUS_LABELS: Record<DnaStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const STATUS_STYLES: Record<DnaStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-green-100 text-green-800",
  archived: "bg-slate-200 text-slate-500",
};

export function DnaStatusBadge({ status }: { status: DnaStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {DNA_STATUS_LABELS[status]}
    </span>
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
      <div className="rounded-lg border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-500">
        No versions yet. Save a draft to create Version 1.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {versions.map((version) => (
        <li
          key={version.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-800">
              Version {version.versionNumber}
            </span>
            <DnaStatusBadge status={version.status} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">Updated {formatDate(version.updatedAt)}</span>
            {canManage && version.status !== "archived" ? (
              <form action={archiveDnaVersionAction}>
                <input type="hidden" name="employeeId" value={employeeId} />
                <input type="hidden" name="versionId" value={version.id} />
                <button
                  type="submit"
                  className="text-xs font-medium text-slate-500 hover:text-red-600"
                >
                  Archive
                </button>
              </form>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
