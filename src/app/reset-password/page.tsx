import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Notice } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Update password (Sprint 012). Reached from a password-reset email link, which
 * establishes a temporary recovery session; the user sets a new password here.
 */
export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a new password for your Taurus AI account."
      footer={
        <>
          Need a new link?{" "}
          <Link href="/forgot-password" className="font-medium text-taurus-text hover:underline">
            Request another
          </Link>
        </>
      }
    >
      {isSupabaseConfigured() ? (
        <ResetPasswordForm />
      ) : (
        <div className="mt-6">
          <Notice>Password reset requires Supabase Auth, which is not configured here.</Notice>
        </div>
      )}
    </AuthShell>
  );
}
