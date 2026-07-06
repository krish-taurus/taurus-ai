"use client";

/**
 * Lifecycle action buttons for an AI Employee (Prompt 003).
 *
 * Renders Pause/Activate and Archive controls that post to server actions. Only
 * shown to users who can manage employees (checked again server-side). Archive
 * asks for confirmation since it takes the employee out of service.
 */

import Link from "next/link";
import type { AiEmployee } from "@/lib/db/types";
import {
  activateEmployeeAction,
  archiveEmployeeAction,
  pauseEmployeeAction,
} from "@/modules/employees/actions";

const secondaryButton =
  "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50";

export function EmployeeActions({ employee }: { employee: AiEmployee }) {
  const isArchived = employee.status === "archived";
  const isPaused = employee.status === "paused";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link href={`/dashboard/employees/${employee.id}/edit`} className={secondaryButton}>
        Edit
      </Link>

      {!isArchived && isPaused ? (
        <form action={activateEmployeeAction}>
          <input type="hidden" name="employeeId" value={employee.id} />
          <button type="submit" className={secondaryButton}>
            Activate
          </button>
        </form>
      ) : null}

      {!isArchived && !isPaused ? (
        <form action={pauseEmployeeAction}>
          <input type="hidden" name="employeeId" value={employee.id} />
          <button type="submit" className={secondaryButton}>
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
          <button
            type="submit"
            className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            Archive
          </button>
        </form>
      ) : null}
    </div>
  );
}
