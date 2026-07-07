"use client";

/**
 * Forgot-password form (Sprint 012).
 *
 * Sends a Supabase password-reset email whose link returns to /reset-password
 * (via the auth callback) where the user sets a new password. Always shows a
 * neutral confirmation so the form never reveals whether an email is registered.
 */

import Link from "next/link";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buttonClasses, Field, FieldError, Input, Notice } from "@/components/ui";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) {
      setError("Enter your email address.");
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", "/reset-password");
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo.toString(),
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch {
      // Neutral message — never disclose whether the email exists.
      setSent(true);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-6 space-y-4">
        <Notice>
          If an account exists for that email, we&apos;ve sent a link to reset your password.
        </Notice>
        <Link href="/login" className={buttonClasses("secondary", "lg", "w-full")}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
      {error ? <FieldError>{error}</FieldError> : null}
      <button type="submit" disabled={pending} className={buttonClasses("primary", "lg", "w-full")}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
