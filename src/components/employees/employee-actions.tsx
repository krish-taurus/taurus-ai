"use client";

/**
 * Lifecycle action buttons for an AI Employee (Prompt 003; restyled 005B).
 *
 * Renders Edit / Pause / Activate / Archive controls that post to server
 * actions. Only shown to users who can manage employees (re-checked server-side).
 * Archive asks for confirmation since it takes the employee out of service.
 */

import Link from "next/link";
import type { AiEmployee } from "@/lib/db/types";
import {
  activateEmployeeAction,
  archiveEmployeeAction,
  pauseEmployeeAction,
} from "@/modules/employees/actions";
import { buttonClasses } from "@/components/ui";

export function EmployeeActions({ employee }: { employee: AiEmployee }) {
  const isArchived = employee.status === "archived";
  const isPaused = employee.status === "paused";

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Link
        href={`/dashboard/employees/${employee.id}/edit`}
        className={buttonClasses("secondary")}
      >
        Edit Employee
      </Link>

      {!isArchived && isPaused ? (
        <form action={activateEmployeeAction}>
          <input type="hidden" name="employeeId" value={employee.id} />
          <button type="submit" className={buttonClasses("outline")}>
            Activate
          </button>
        </form>
      ) : null}

      {!isArchived && !isPaused ? (
        <form action={pauseEmployeeAction}>
          <input type="hidden" name="employeeId" value={employee.id} />
          <button type="submit" className={buttonClasses("outline")}>
            Pause
          </button>
        </form>
      ) : null}

      {!isArchived ? (
        <form
          action={archiveEmployeeAction}
          onSubmit={(e) => {
            if (!window.confirm(`Archive ${employee.name}? They will be taken out of service.`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="employeeId" value={employee.id} />
          <button type="submit" className={buttonClasses("danger")}>
            Archive
          </button>
        </form>
      ) : null}
    </div>
  );
}
