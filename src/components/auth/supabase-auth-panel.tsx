"use client";

/**
 * Supabase auth panel (Sprint 012) — the production sign-in / sign-up surface.
 *
 * Sign in offers: Google, LinkedIn, email + password, and email OTP / magic
 * link, plus a forgot-password link. Sign up offers: Google, LinkedIn, and email
 * + password. All flows run in the browser via the Supabase client; OAuth and
 * OTP complete at /auth/callback. Clear loading, error, and success states.
 *
 * No secret handling here — passwords go straight to Supabase Auth and are never
 * stored in Taurus tables.
 */

import Link from "next/link";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { buttonClasses, Field, FieldError, Input, Notice } from "@/components/ui";

type Mode = "signin" | "signup";
type EmailMethod = "password" | "otp";

function Divider({ label }: { label: string }) {
  return (
    <div className="my-6 flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-taurus-line" />
      <span className="text-xs uppercase tracking-[0.18em] text-taurus-faint">{label}</span>
      <span className="h-px flex-1 bg-taurus-line" />
    </div>
  );
}

export function SupabaseAuthPanel({ mode, next }: { mode: Mode; next?: string }) {
  const isSignup = mode === "signup";
  const [method, setMethod] = useState<EmailMethod>("password");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function callbackUrl(): string {
    const url = new URL("/auth/callback", window.location.origin);
    if (next) url.searchParams.set("next", next);
    return url.toString();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("fullName") ?? "").trim();

    if (!email) {
      setError("Enter your email address.");
      return;
    }

    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // Passwordless email OTP / magic link (sign in only).
      if (!isSignup && method === "otp") {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: callbackUrl(), shouldCreateUser: false },
        });
        if (otpError) throw otpError;
        setNotice("Check your email for a one-time sign-in link.");
        return;
      }

      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: callbackUrl(),
            data: fullName ? { full_name: fullName } : undefined,
          },
        });
        if (signUpError) throw signUpError;
        // With email confirmation enabled Supabase returns no session yet.
        if (!data.session) {
          setNotice("Check your email to confirm your account and finish signing up.");
          return;
        }
        window.location.assign(next || "/dashboard");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      window.location.assign(next || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const showPassword = isSignup || method === "password";

  return (
    <div className="mt-6">
      <OAuthButtons next={next} verb={isSignup ? "Sign up" : "Continue"} />

      <Divider label="or" />

      <form onSubmit={onSubmit} className="space-y-4">
        {isSignup ? (
          <Field label="Full name" htmlFor="fullName" optional>
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

        {showPassword ? (
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder="At least 8 characters"
            />
          </Field>
        ) : null}

        {error ? <FieldError>{error}</FieldError> : null}
        {notice ? <Notice>{notice}</Notice> : null}

        <button
          type="submit"
          disabled={pending}
          className={buttonClasses("primary", "lg", "w-full")}
        >
          {pending
            ? "Please wait…"
            : isSignup
              ? "Create account"
              : method === "otp"
                ? "Email me a sign-in link"
                : "Sign in"}
        </button>
      </form>

      {!isSignup ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setMethod((m) => (m === "password" ? "otp" : "password"));
              setError(null);
              setNotice(null);
            }}
            className="font-medium text-taurus-sub transition-colors hover:text-taurus-text"
          >
            {method === "password" ? "Use a one-time email link" : "Use a password instead"}
          </button>
          <Link
            href="/forgot-password"
            className="font-medium text-taurus-sub transition-colors hover:text-taurus-text"
          >
            Forgot password?
          </Link>
        </div>
      ) : null}
    </div>
  );
}
