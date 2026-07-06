/**
 * Status and visibility badges for AI Employees (Prompt 003).
 * Presentation-only; labels come from the employees metadata module.
 */

import type { EmployeeStatus, EmployeeVisibility } from "@/lib/db/types";
import { EMPLOYEE_STATUS_LABELS, EMPLOYEE_VISIBILITY_LABELS } from "@/modules/employees/metadata";

const STATUS_STYLES: Record<EmployeeStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  training: "bg-amber-100 text-amber-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  archived: "bg-slate-200 text-slate-500",
};

export function StatusBadge({ status }: { status: EmployeeStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {EMPLOYEE_STATUS_LABELS[status]}
    </span>
  );
}

export function VisibilityBadge({ visibility }: { visibility: EmployeeVisibility }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
      {EMPLOYEE_VISIBILITY_LABELS[visibility]}
    </span>
  );
}
