import Link from "next/link";

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Set up your organization</h1>
      <p className="mt-2 text-sm text-slate-600">
        Onboarding is a placeholder in this foundation build. Here you will name your organization
        and invite teammates before hiring your first AI employee.
      </p>
      <div className="mt-6">
        <Link
          href="/dashboard"
          className="block rounded-md bg-taurus-accent px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
