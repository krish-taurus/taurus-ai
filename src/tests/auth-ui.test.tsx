import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SupabaseAuthPanel } from "@/components/auth/supabase-auth-panel";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

/**
 * These render the production Supabase auth UI (client components). They assert
 * every required auth option is present; the flows themselves call Supabase in
 * the browser and are exercised manually / in staging.
 */

describe("Supabase auth UI (Sprint 012)", () => {
  it("sign in offers Google, LinkedIn, email + password, OTP, and forgot password", () => {
    const { container, getByText, getByLabelText } = render(<SupabaseAuthPanel mode="signin" />);
    const text = container.textContent ?? "";
    expect(text).toContain("Continue with Google");
    expect(text).toContain("Continue with LinkedIn");
    expect(getByLabelText("Work email")).toBeTruthy();
    expect(getByLabelText("Password")).toBeTruthy();
    // Passwordless email OTP / magic link toggle.
    expect(getByText("Use a one-time email link")).toBeTruthy();
    // Forgot-password link routes to the reset flow.
    expect(getByText("Forgot password?").closest("a")?.getAttribute("href")).toBe(
      "/forgot-password",
    );
  });

  it("sign up offers Google, LinkedIn, full name, email + password", () => {
    const { container, getByLabelText, getByText } = render(<SupabaseAuthPanel mode="signup" />);
    const text = container.textContent ?? "";
    expect(text).toContain("Sign up with Google");
    expect(text).toContain("Sign up with LinkedIn");
    expect(getByLabelText(/Full name/)).toBeTruthy();
    expect(getByLabelText("Work email")).toBeTruthy();
    expect(getByLabelText("Password")).toBeTruthy();
    expect(getByText("Create account")).toBeTruthy();
  });

  it("renders both OAuth provider buttons as real buttons", () => {
    const { getByText } = render(<OAuthButtons verb="Continue" />);
    expect(getByText("Continue with Google").closest("button")).toBeTruthy();
    expect(getByText("Continue with LinkedIn").closest("button")).toBeTruthy();
  });

  it("renders password reset request and update forms", () => {
    expect(render(<ForgotPasswordForm />).getByText("Send reset link")).toBeTruthy();
    const reset = render(<ResetPasswordForm />);
    expect(reset.getByLabelText("New password")).toBeTruthy();
    expect(reset.getByLabelText("Confirm new password")).toBeTruthy();
    expect(reset.getByText("Update password")).toBeTruthy();
  });
});
