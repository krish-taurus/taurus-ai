"use client";

/**
 * Shared auth form (Prompt 002) for sign-in / sign-up.
 *
 * Uses a server action via useFormState so validation errors render inline and
 * pending state disables the button. The dev auth flow is passwordless (email
 * only) — a real provider adds password/SSO fields here later.
 */

import { useFormState, useFormStatus } from "react-dom";
import type { AuthActionState } from "@/modules/auth/actions";

type AuthAction = (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-taurus-accent px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
    >
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
        <div>
          <label htmlFor="fullName" className="mb-1 block text-sm font-medium text-slate-700">
            Full name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-taurus-accent focus:outline-none focus:ring-1 focus:ring-taurus-accent"
            placeholder="Jane Founder"
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-taurus-accent focus:outline-none focus:ring-1 focus:ring-taurus-accent"
          placeholder="you@company.com"
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}

      <SubmitButton label={submitLabel} />
    </form>
  );
}
