"use server";

/**
 * Authentication server actions (Prompt 002).
 *
 * Sign-up / sign-in go through the auth provider, then issue a signed session
 * cookie. Sign-out clears the session and selected-organization cookies. Actions
 * return `{ error }` for form display and redirect on success.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { createSessionToken, SESSION_COOKIE } from "@/lib/security/session";
import { ORG_COOKIE } from "@/lib/security/guards";
import { emailSchema, fullNameSchema, getAuthProvider } from "@/modules/auth/provider";

export interface AuthActionState {
  error?: string;
}

function setSessionCookie(token: string): void {
  cookies().set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const emailResult = emailSchema.safeParse(formData.get("email"));
  if (!emailResult.success) {
    return { error: emailResult.error.issues[0]?.message ?? "Invalid email." };
  }
  const nameResult = fullNameSchema.safeParse(formData.get("fullName") || undefined);
  if (!nameResult.success) {
    return { error: "Please enter a valid name." };
  }

  const store = getStore();
  let userId: string;
  try {
    const user = await getAuthProvider().signUp(store, emailResult.data, nameResult.data);
    userId = user.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not create account." };
  }

  setSessionCookie(await createSessionToken(userId));
  redirect("/onboarding");
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const emailResult = emailSchema.safeParse(formData.get("email"));
  if (!emailResult.success) {
    return { error: emailResult.error.issues[0]?.message ?? "Invalid email." };
  }

  const store = getStore();
  let userId: string;
  try {
    const user = await getAuthProvider().signIn(store, emailResult.data);
    if (!user) {
      return { error: "No account found for this email. Create an account to get started." };
    }
    userId = user.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not sign in." };
  }

  setSessionCookie(await createSessionToken(userId));
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
  cookies().delete(ORG_COOKIE);
  redirect("/login");
}
