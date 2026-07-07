import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { SupabaseAuthPanel } from "@/components/auth/supabase-auth-panel";
import { DevAuthPanel } from "@/components/auth/dev-auth-panel";
import { AuthErrorBanner } from "@/components/auth/auth-error-banner";
import { Notice } from "@/components/ui";
import { isDevAuthAvailable, isSupabaseConfigured } from "@/lib/supabase/config";
import { sanitizeNextPath } from "@/modules/auth/post-auth";

/**
 * Sign in (Sprint 012). Production auth via Supabase: Google, LinkedIn, email +
 * password, and email OTP / magic link, plus forgot password. Falls back to the
 * development flow only when Supabase is not configured and dev auth is allowed.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const supabaseReady = isSupabaseConfigured();
  const devAuth = isDevAuthAvailable();
  const next = sanitizeNextPath(searchParams.next) ?? undefined;

  return (
    <AuthShell
      title="Sign in to Taurus AI"
      subtitle="Access your AI workforce. Continue with a provider, your email and password, or a one-time link."
      footer={
        <>
          New to Taurus AI?{" "}
          <Link href="/signup" className="font-medium text-taurus-text hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <AuthErrorBanner error={searchParams.error} />

      {supabaseReady ? (
        <>
          <SupabaseAuthPanel mode="signin" next={next} />
          {devAuth ? <DevAuthPanel mode="signin" /> : null}
        </>
      ) : devAuth ? (
        <>
          <div className="mt-6">
            <Notice>
              Supabase Auth is not configured. Using the development sign-in flow for local access.
            </Notice>
          </div>
          <DevAuthPanel mode="signin" />
        </>
      ) : (
        <div className="mt-6">
          <Notice>Authentication is not configured. Set up Supabase Auth to sign in.</Notice>
        </div>
      )}
    </AuthShell>
  );
}
