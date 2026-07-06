/**
 * Employee Card (Prompt 003; restyled Sprint 005B).
 *
 * Compact, premium summary of an AI Employee. Displays name, role title,
 * department, status, visibility, and last updated. Links to the profile and
 * lifts subtly on hover.
 */

import Link from "next/link";
import type { AiEmployee } from "@/lib/db/types";
import { formatDate } from "@/lib/format";
import { StatusBadge, VisibilityBadge } from "@/components/employees/employee-badges";
import { Card } from "@/components/ui";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "AI";
}

export function EmployeeCard({ employee }: { employee: AiEmployee }) {
  return (
    <Link href={`/dashboard/employees/${employee.id}`} className="group block rounded-xl">
      <Card hover className="flex h-full flex-col p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-taurus-line bg-taurus-elevated text-sm font-semibold text-taurus-text">
            {initials(employee.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-taurus-text">{employee.name}</h3>
            <p className="truncate text-sm text-taurus-sub">{employee.roleTitle}</p>
          </div>
        </div>

        <p className="mt-3 text-sm text-taurus-faint">{employee.department ?? "No department"}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={employee.status} />
          <VisibilityBadge visibility={employee.visibility} />
        </div>

        <p className="mt-4 text-xs text-taurus-faint">
          Last updated {formatDate(employee.updatedAt)}
        </p>
      </Card>
    </Link>
  );
}
