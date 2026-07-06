"use client";

/**
 * Edit AI Employee form (Prompt 003).
 *
 * Prefilled from the existing employee. Posts to updateEmployeeAction. Status and
 * visibility use plain-language labels. The employee id travels in a hidden field
 * but the server still re-validates that it belongs to the current organization.
 */

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import type { AiEmployee } from "@/lib/db/types";
import { updateEmployeeAction, type EmployeeActionState } from "@/modules/employees/actions";
import {
  EMPLOYEE_STATUSES,
  EMPLOYEE_STATUS_LABELS,
  EMPLOYEE_VISIBILITIES,
  EMPLOYEE_VISIBILITY_LABELS,
} from "@/modules/employees/metadata";

const inputClass =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-taurus-accent focus:outline-none focus:ring-1 focus:ring-taurus-accent";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-taurus-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export function EditEmployeeForm({ employee }: { employee: AiEmployee }) {
  const [state, formAction] = useFormState(updateEmployeeAction, {} as EmployeeActionState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="employeeId" value={employee.id} />

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          defaultValue={employee.name}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="roleTitle" className="mb-1 block text-sm font-medium text-slate-700">
          Role title
        </label>
        <input
          id="roleTitle"
          name="roleTitle"
          type="text"
          required
          minLength={2}
          defaultValue={employee.roleTitle}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="department" className="mb-1 block text-sm font-medium text-slate-700">
          Department <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="department"
          name="department"
          type="text"
          defaultValue={employee.department ?? ""}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="status" className="mb-1 block text-sm font-medium text-slate-700">
            Status
          </label>
          <select id="status" name="status" defaultValue={employee.status} className={inputClass}>
            {EMPLOYEE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EMPLOYEE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="visibility" className="mb-1 block text-sm font-medium text-slate-700">
            Visibility
          </label>
          <select
            id="visibility"
            name="visibility"
            defaultValue={employee.visibility}
            className={inputClass}
          >
            {EMPLOYEE_VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {EMPLOYEE_VISIBILITY_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
          Description <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={employee.description ?? ""}
          className={inputClass}
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <SubmitButton />
        <Link
          href={`/dashboard/employees/${employee.id}`}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
