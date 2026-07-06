"use client";

/**
 * Edit AI Employee form (Prompt 003; restyled Sprint 005B).
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
import { buttonClasses, Field, FieldError, Input, Select, Textarea } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export function EditEmployeeForm({ employee }: { employee: AiEmployee }) {
  const [state, formAction] = useFormState(updateEmployeeAction, {} as EmployeeActionState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="employeeId" value={employee.id} />

      <Field label="Name" htmlFor="name">
        <Input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          defaultValue={employee.name}
        />
      </Field>

      <Field label="Role title" htmlFor="roleTitle">
        <Input
          id="roleTitle"
          name="roleTitle"
          type="text"
          required
          minLength={2}
          defaultValue={employee.roleTitle}
        />
      </Field>

      <Field label="Department" htmlFor="department" optional>
        <Input
          id="department"
          name="department"
          type="text"
          defaultValue={employee.department ?? ""}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={employee.status}>
            {EMPLOYEE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EMPLOYEE_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Visibility" htmlFor="visibility">
          <Select id="visibility" name="visibility" defaultValue={employee.visibility}>
            {EMPLOYEE_VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {EMPLOYEE_VISIBILITY_LABELS[v]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Description" htmlFor="description" optional>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={employee.description ?? ""}
        />
      </Field>

      {state?.error ? <FieldError>{state.error}</FieldError> : null}

      <div className="flex items-center gap-4">
        <SubmitButton />
        <Link
          href={`/dashboard/employees/${employee.id}`}
          className="text-sm font-medium text-taurus-sub transition-colors hover:text-taurus-text"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
