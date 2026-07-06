import Link from "next/link";

/** Shown when an AI Employee is not found in the current organization. */
export default function EmployeeNotFound() {
  return (
    <div className="max-w-3xl rounded-lg border border-slate-200 bg-white px-6 py-16 text-center">
      <h1 className="text-lg font-semibold text-slate-900">AI Employee not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        This AI Employee does not exist in your organization, or it may have been removed.
      </p>
      <Link
        href="/dashboard/employees"
        className="mt-6 inline-flex items-center rounded-md bg-taurus-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
      >
        Back to AI Employees
      </Link>
    </div>
  );
}
