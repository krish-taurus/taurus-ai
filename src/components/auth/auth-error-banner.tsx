/**
 * Auth error banner (Sprint 012).
 *
 * Renders a friendly message for the `?error=` codes the /auth/callback route
 * appends on failure. Never surfaces raw provider errors.
 */

import { FieldError } from "@/components/ui";

const MESSAGES: Record<string, string> = {
  auth_failed: "That sign-in link didn't work or has expired. Please try again.",
  auth_unavailable: "Sign-in is temporarily unavailable. Please try again shortly.",
};

export function AuthErrorBanner({ error }: { error?: string }) {
  if (!error) return null;
  const message = MESSAGES[error] ?? "Something went wrong signing you in. Please try again.";
  return (
    <div className="mt-6">
      <FieldError>{message}</FieldError>
    </div>
  );
}
