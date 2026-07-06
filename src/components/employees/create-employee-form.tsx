"use client";

/**
 * Create AI Employee form (Prompt 003).
 *
 * Posts to the createEmployeeAction server action. Choosing a template pre-fills
 * a suggested role title and department (the user can still edit them). On
 * success the action redirects to the new employee's profile.
 */

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createEmployeeAction, type EmployeeActionState } from "@/modules/employees/actions";
import { EMPLOYEE_TEMPLATES } from "@/modules/employees/metadata";

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
      {pending ? "Hiring…" : "Hire AI Employee"}
    </button>
  );
}

export function CreateEmployeeForm() {
  const [state, formAction] = useFormState(createEmployeeAction, {} as EmployeeActionState);
  const [roleTitle, setRoleTitle] = useState("");
  const [department, setDepartment] = useState("");

  function applyTemplate(key: string) {
    const template = EMPLOYEE_TEMPLATES.find((t) => t.key === key);
    if (!template) return;
    setRoleTitle(template.suggestedRoleTitle);
    setDepartment(template.suggestedDepartment);
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="template" className="mb-1 block text-sm font-medium text-slate-700">
          Start from a template
        </label>
        <select
          id="template"
          name="template"
          defaultValue="custom"
          onChange={(e) => applyTemplate(e.target.value)}
          className={inputClass}
        >
          {EMPLOYEE_TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Templates prefill a suggested role — you can change everything below.
        </p>
      </div>

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
          className={inputClass}
          placeholder="Maya"
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
          value={roleTitle}
          onChange={(e) => setRoleTitle(e.target.value)}
          className={inputClass}
          placeholder="Customer Support AI"
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
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className={inputClass}
          placeholder="Support"
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
          Description <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className={inputClass}
          placeholder="What will this AI Employee help with?"
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <SubmitButton />
      </div>
    </form>
  );
}
