import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Sign in to Taurus AI</h1>
      <p className="mt-2 text-sm text-slate-600">
        Sign-in is a placeholder in this foundation build. Authentication is added in a later step.
      </p>
      <div className="mt-6 space-y-3">
        <Link
          href="/dashboard"
          className="block rounded-md bg-taurus-accent px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
        >
          Continue to dashboard
        </Link>
        <p className="text-center text-sm text-slate-600">
          New to Taurus AI?{" "}
          <Link href="/signup" className="font-medium text-taurus-accent hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
