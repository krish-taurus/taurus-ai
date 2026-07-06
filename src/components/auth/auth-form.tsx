"use client";

/**
 * Shared auth form (Prompt 002; restyled Sprint 005B) for sign-in / sign-up.
 *
 * Uses a server action via useFormState so validation errors render inline and
 * pending state disables the button. The dev auth flow is passwordless (email
 * only) — a real provider adds password/SSO fields here later.
 */

import { useFormState, useFormStatus } from "react-dom";
import type { AuthActionState } from "@/modules/auth/actions";
import { buttonClasses, Field, FieldError, Input } from "@/components/ui";

type AuthAction = (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "lg", "w-full")}>
      {pending ? "Please wait…" : label}
    </button>
  );
}

export function AuthForm({
  action,
  submitLabel,
  includeName = false,
}: {
  action: AuthAction;
  submitLabel: string;
  includeName?: boolean;
}) {
  const [state, formAction] = useFormState(action, {} as AuthActionState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {includeName ? (
        <Field label="Full name" htmlFor="fullName">
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Jane Founder"
          />
        </Field>
      ) : null}

      <Field label="Work email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
        />
      </Field>

      {state?.error ? <FieldError>{state.error}</FieldError> : null}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
