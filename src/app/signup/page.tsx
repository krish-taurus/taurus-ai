import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SupabaseAuthPanel } from "@/components/auth/supabase-auth-panel";
import { DevAuthPanel } from "@/components/auth/dev-auth-panel";
import { AuthErrorBanner } from "@/components/auth/auth-error-banner";
import { Notice } from "@/components/ui";
import { isDevAuthAvailable, isSupabaseConfigured } from "@/lib/supabase/config";
import { sanitizeNextPath } from "@/modules/auth/post-auth";

/**
 * Sign up (Sprint 012). Production auth via Supabase: Google, LinkedIn, and
 * email + password. Falls back to the development flow only when Supabase is not
 * configured and dev auth is allowed. The user sets up their organization next.
 */
export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const supabaseReady = isSupabaseConfigured();
  const devAuth = isDevAuthAvailable();
  const next = sanitizeNextPath(searchParams.next) ?? undefined;

  return (
    <AuthShell
      title="Create your Taurus AI account"
      subtitle="Hire your first AI Employee in five minutes. You will set up your organization next."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-taurus-text hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <AuthErrorBanner error={searchParams.error} />

      {supabaseReady ? (
        <>
          <SupabaseAuthPanel mode="signup" next={next} />
          {devAuth ? <DevAuthPanel mode="signup" /> : null}
        </>
      ) : devAuth ? (
        <>
          <div className="mt-6">
            <Notice>
              Supabase Auth is not configured. Using the development sign-up flow for local access.
            </Notice>
          </div>
          <DevAuthPanel mode="signup" />
        </>
      ) : (
        <div className="mt-6">
          <Notice>Authentication is not configured. Set up Supabase Auth to sign up.</Notice>
        </div>
      )}
    </AuthShell>
  );
}
