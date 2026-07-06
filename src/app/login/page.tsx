import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { signIn } from "@/modules/auth/actions";

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in to Taurus AI"
      subtitle="Enter your work email to access your organizations."
      footer={
        <>
          New to Taurus AI?{" "}
          <Link href="/signup" className="font-medium text-taurus-text hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <AuthForm action={signIn} submitLabel="Sign in" />
    </AuthShell>
  );
}
