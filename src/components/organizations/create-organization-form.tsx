"use client";

/**
 * Create-organization form (Prompt 002).
 *
 * Posts to the createOrganization server action. On success the action redirects
 * into the dashboard; on failure the error renders inline.
 */

import { useFormState, useFormStatus } from "react-dom";
import { createOrganization, type OrganizationActionState } from "@/modules/organizations/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-taurus-accent px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create organization"}
    </button>
  );
}

export function CreateOrganizationForm() {
  const [state, formAction] = useFormState(createOrganization, {} as OrganizationActionState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
          Organization name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-taurus-accent focus:outline-none focus:ring-1 focus:ring-taurus-accent"
          placeholder="Acme Inc."
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
