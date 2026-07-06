import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { signUp } from "@/modules/auth/actions";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Create your Taurus AI account</h1>
      <p className="mt-2 text-sm text-slate-600">
        Start hiring AI employees in five minutes. You will set up your organization next.
      </p>

      <AuthForm action={signUp} submitLabel="Create account" includeName />

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-taurus-accent hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
