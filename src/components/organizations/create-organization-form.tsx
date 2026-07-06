"use client";

/**
 * Create-organization form (Prompt 002; restyled Sprint 005B).
 *
 * Posts to the createOrganization server action. On success the action redirects
 * into the dashboard; on failure the error renders inline.
 */

import { useFormState, useFormStatus } from "react-dom";
import { createOrganization, type OrganizationActionState } from "@/modules/organizations/actions";
import { buttonClasses, Field, FieldError, Input } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "lg", "w-full")}>
      {pending ? "Creating…" : "Create organization"}
    </button>
  );
}

export function CreateOrganizationForm() {
  const [state, formAction] = useFormState(createOrganization, {} as OrganizationActionState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <Field label="Organization name" htmlFor="name">
        <Input id="name" name="name" type="text" required minLength={2} placeholder="Acme Inc." />
      </Field>

      {state?.error ? <FieldError>{state.error}</FieldError> : null}

      <SubmitButton />
    </form>
  );
}
