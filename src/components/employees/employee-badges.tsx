/**
 * Status and visibility badges for AI Employees (Prompt 003; restyled 005B).
 *
 * Monochrome. Status is conveyed by the label plus a status dot whose fill level
 * differs per state, so it never relies on color alone.
 */

import type { EmployeeStatus, EmployeeVisibility } from "@/lib/db/types";
import { EMPLOYEE_STATUS_LABELS, EMPLOYEE_VISIBILITY_LABELS } from "@/modules/employees/metadata";
import { Badge, StatusDot } from "@/components/ui";

const STATUS_LEVEL: Record<EmployeeStatus, 0 | 1 | 2 | 3> = {
  active: 3,
  training: 2,
  draft: 1,
  paused: 0,
  archived: 0,
};

export function StatusBadge({ status }: { status: EmployeeStatus }) {
  return (
    <Badge tone={status === "archived" ? "outline" : "soft"}>
      <StatusDot level={STATUS_LEVEL[status]} />
      {EMPLOYEE_STATUS_LABELS[status]}
    </Badge>
  );
}

export function VisibilityBadge({ visibility }: { visibility: EmployeeVisibility }) {
  return <Badge tone="outline">{EMPLOYEE_VISIBILITY_LABELS[visibility]}</Badge>;
}
