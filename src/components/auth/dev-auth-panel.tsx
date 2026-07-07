/**
 * Development auth panel (Sprint 012).
 *
 * A clearly-labeled fallback that exposes the passwordless dev sign-in / sign-up
 * flow. Rendered ONLY when dev auth is available (never in production unless
 * TAURUS_ALLOW_DEV_AUTH=true), so the insecure flow is hidden from production.
 */

import { AuthForm } from "@/components/auth/auth-form";
import { signIn, signUp } from "@/modules/auth/actions";

export function DevAuthPanel({ mode }: { mode: "signin" | "signup" }) {
  const isSignup = mode === "signup";
  return (
    <div className="mt-8 border-t border-taurus-line pt-6">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-taurus-faint">
        Development access
      </p>
      <p className="mt-1 text-xs text-taurus-faint">
        Passwordless email sign-in for local development only. Not available in production.
      </p>
      {isSignup ? (
        <AuthForm action={signUp} submitLabel="Create dev account" includeName />
      ) : (
        <AuthForm action={signIn} submitLabel="Continue with dev email" />
      )}
    </div>
  );
}
