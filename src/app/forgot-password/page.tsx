import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Notice } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Forgot password (Sprint 012). Sends a Supabase password-reset email.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to set a new password."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-taurus-text hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      {isSupabaseConfigured() ? (
        <ForgotPasswordForm />
      ) : (
        <div className="mt-6">
          <Notice>Password reset requires Supabase Auth, which is not configured here.</Notice>
        </div>
      )}
    </AuthShell>
  );
}
