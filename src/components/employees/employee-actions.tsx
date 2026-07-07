"use client";

/**
 * Lifecycle action buttons for an AI Employee (Prompt 003; restyled 005B).
 *
 * Renders Edit / Pause / Activate / Archive controls that post to server
 * actions. Only shown to users who can manage employees (re-checked server-side).
 * Archive asks for confirmation since it takes the employee out of service. A
 * failed transition (permission or store error) surfaces an inline message.
 */

import Link from "next/link";
import { useFormState } from "react-dom";
import type { ReactNode } from "react";
import type { AiEmployee } from "@/lib/db/types";
import {
  activateEmployeeAction,
  archiveEmployeeAction,
  pauseEmployeeAction,
  type EmployeeActionState,
} from "@/modules/employees/actions";
import { buttonClasses, FieldError } from "@/components/ui";

type LifecycleAction = (
  prevState: EmployeeActionState,
  formData: FormData,
) => Promise<EmployeeActionState>;

/** One lifecycle form wired to useFormState so its errors are shown. */
function LifecycleForm({
  action,
  employeeId,
  children,
  onSubmit,
}: {
  action: LifecycleAction;
  employeeId: string;
  children: ReactNode;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [state, formAction] = useFormState(action, {} as EmployeeActionState);
  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-1">
      <input type="hidden" name="employeeId" value={employeeId} />
      {children}
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}

export function EmployeeActions({ employee }: { employee: AiEmployee }) {
  const isArchived = employee.status === "archived";
  const isPaused = employee.status === "paused";

  return (
    <div className="flex flex-wrap items-start gap-2.5">
      <Link
        href={`/dashboard/employees/${employee.id}/edit`}
        className={buttonClasses("secondary")}
      >
        Edit Employee
      </Link>

      {!isArchived && isPaused ? (
        <LifecycleForm action={activateEmployeeAction} employeeId={employee.id}>
          <button type="submit" className={buttonClasses("outline")}>
            Activate
          </button>
        </LifecycleForm>
      ) : null}

      {!isArchived && !isPaused ? (
        <LifecycleForm action={pauseEmployeeAction} employeeId={employee.id}>
          <button type="submit" className={buttonClasses("outline")}>
            Pause
          </button>
        </LifecycleForm>
      ) : null}

      {!isArchived ? (
        <LifecycleForm
          action={archiveEmployeeAction}
          employeeId={employee.id}
          onSubmit={(e) => {
            if (!window.confirm(`Archive ${employee.name}? They will be taken out of service.`)) {
              e.preventDefault();
            }
          }}
        >
          <button type="submit" className={buttonClasses("danger")}>
            Archive
          </button>
        </LifecycleForm>
      ) : null}
    </div>
  );
}
