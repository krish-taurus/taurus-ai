"use client";

/**
 * Social sign-in buttons (Sprint 012) — Google and LinkedIn.
 *
 * Kick off Supabase OAuth in the browser. Supabase redirects to the provider,
 * then back to /auth/callback which exchanges the code and routes onward. The
 * `next` path is preserved through the round trip.
 *
 * Monochrome, premium, accessible. A per-provider pending state disables both
 * buttons and surfaces any error inline.
 */

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FieldError } from "@/components/ui";

type OAuthProvider = "google" | "linkedin_oidc";

const PROVIDERS: { id: OAuthProvider; label: string; icon: JSX.Element }[] = [
  {
    id: "google",
    label: "Google",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M12 11v3.2h4.5c-.2 1.2-1.4 3.5-4.5 3.5A5.2 5.2 0 0 1 12 6.8c1.5 0 2.5.6 3.1 1.2l2.1-2C15.9 4.7 14.1 4 12 4a8 8 0 1 0 0 16c4.6 0 7.6-3.2 7.6-7.7 0-.5-.1-.9-.2-1.3H12z" />
      </svg>
    ),
  },
  {
    id: "linkedin_oidc",
    label: "LinkedIn",
    icon: (
      <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M6.94 5A1.94 1.94 0 1 1 3 5a1.94 1.94 0 0 1 3.94 0zM3.4 8.4h3.1V21H3.4V8.4zM9 8.4h2.97v1.72h.04c.41-.78 1.42-1.6 2.93-1.6 3.13 0 3.71 2.06 3.71 4.74V21h-3.09v-5.28c0-1.26-.02-2.88-1.75-2.88-1.76 0-2.03 1.37-2.03 2.79V21H9V8.4z" />
      </svg>
    ),
  },
];

export function OAuthButtons({ next, verb }: { next?: string; verb: "Continue" | "Sign up" }) {
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInWith(provider: OAuthProvider) {
    setError(null);
    setPending(provider);
    try {
      const supabase = createSupabaseBrowserClient();
      const callback = new URL("/auth/callback", window.location.origin);
      if (next) callback.searchParams.set("next", next);
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callback.toString() },
      });
      if (oauthError) {
        setError(oauthError.message);
        setPending(null);
      }
      // On success the browser is redirected to the provider; no reset needed.
    } catch {
      setError("Could not start sign-in. Please try again.");
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => signInWith(provider.id)}
            disabled={pending !== null}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-taurus-line bg-taurus-elevated px-4 py-2.5 text-sm font-medium text-taurus-text transition-colors duration-200 hover:border-taurus-strong hover:bg-taurus-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {provider.icon}
            {pending === provider.id ? "Redirecting…" : `${verb} with ${provider.label}`}
          </button>
        ))}
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
