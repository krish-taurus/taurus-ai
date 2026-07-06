import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { signIn } from "@/modules/auth/actions";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Sign in to Taurus AI</h1>
      <p className="mt-2 text-sm text-slate-600">
        Enter your work email to access your organizations.
      </p>

      <AuthForm action={signIn} submitLabel="Sign in" />

      <p className="mt-6 text-center text-sm text-slate-600">
        New to Taurus AI?{" "}
        <Link href="/signup" className="font-medium text-taurus-accent hover:underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
