"use client";

/**
 * Update-password form (Sprint 012).
 *
 * Reached after following a password-reset email link, which establishes a
 * temporary recovery session. Sets the new password via Supabase, then sends the
 * user to their dashboard. Passwords are handled entirely by Supabase Auth.
 */

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buttonClasses, Field, FieldError, Input } from "@/components/ui";

export function ResetPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (password.length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      window.location.assign("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update your password. Request a new reset link and try again.",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <Field label="New password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Re-enter your password"
        />
      </Field>
      {error ? <FieldError>{error}</FieldError> : null}
      <button type="submit" disabled={pending} className={buttonClasses("primary", "lg", "w-full")}>
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
