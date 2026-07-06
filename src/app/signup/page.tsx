import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Create your Taurus AI account</h1>
      <p className="mt-2 text-sm text-slate-600">
        Account creation is a placeholder in this foundation build. The full sign-up and
        organization setup flow is added in a later step.
      </p>
      <div className="mt-6 space-y-3">
        <Link
          href="/onboarding"
          className="block rounded-md bg-taurus-accent px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
        >
          Continue to onboarding
        </Link>
        <p className="text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-taurus-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
