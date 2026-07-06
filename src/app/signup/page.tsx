import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { signUp } from "@/modules/auth/actions";

export default function SignupPage() {
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
      <AuthForm action={signUp} submitLabel="Create account" includeName />
    </AuthShell>
  );
}
