/**
 * Employee Card (Prompt 003).
 *
 * Compact summary of an AI Employee for the list/overview. Displays name, role
 * title, department, status, visibility, and last updated. Links to the profile.
 */

import Link from "next/link";
import type { AiEmployee } from "@/lib/db/types";
import { formatDate } from "@/lib/format";
import { StatusBadge, VisibilityBadge } from "@/components/employees/employee-badges";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "AI";
}

export function EmployeeCard({ employee }: { employee: AiEmployee }) {
  return (
    <Link
      href={`/dashboard/employees/${employee.id}`}
      className="flex flex-col rounded-lg border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-taurus-accent"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-taurus-accent/10 text-sm font-semibold text-taurus-accent">
          {initials(employee.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-slate-900">{employee.name}</h3>
          <p className="truncate text-sm text-slate-600">{employee.roleTitle}</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-500">{employee.department ?? "No department"}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge status={employee.status} />
        <VisibilityBadge visibility={employee.visibility} />
      </div>

      <p className="mt-4 text-xs text-slate-400">Last updated {formatDate(employee.updatedAt)}</p>
    </Link>
  );
}
