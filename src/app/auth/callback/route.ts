/**
 * Supabase auth callback (Sprint 012).
 *
 * The redirect target for OAuth (Google, LinkedIn), email magic links, and email
 * confirmation. Exchanges the returned `code` for a session (setting the auth
 * cookies), ensures a corresponding Taurus user exists, then routes the user to
 * their dashboard, onboarding, or a safe `next` path.
 *
 * The Supabase user id is taken from the verified session — never from client
 * input. On any failure the user is sent back to sign-in with an error flag.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/db/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  resolveTaurusUserForSupabaseIdentity,
  toSupabaseIdentity,
} from "@/modules/auth/supabase-user";
import { resolvePostAuthPath } from "@/modules/auth/post-auth";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const errorDescription = url.searchParams.get("error_description");

  const signinUrl = new URL("/login", url.origin);

  if (!isSupabaseConfigured()) {
    signinUrl.searchParams.set("error", "auth_unavailable");
    return NextResponse.redirect(signinUrl);
  }

  if (errorDescription || !code) {
    signinUrl.searchParams.set("error", "auth_failed");
    return NextResponse.redirect(signinUrl);
  }

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      signinUrl.searchParams.set("error", "auth_failed");
      return NextResponse.redirect(signinUrl);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const identity = user ? toSupabaseIdentity(user) : null;
    if (!identity) {
      signinUrl.searchParams.set("error", "auth_failed");
      return NextResponse.redirect(signinUrl);
    }

    const taurusUser = await resolveTaurusUserForSupabaseIdentity(getStore(), identity);
    const destination = await resolvePostAuthPath(taurusUser.id, next);
    return NextResponse.redirect(new URL(destination, url.origin));
  } catch {
    signinUrl.searchParams.set("error", "auth_failed");
    return NextResponse.redirect(signinUrl);
  }
}
