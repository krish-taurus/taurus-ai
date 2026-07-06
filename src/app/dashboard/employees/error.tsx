"use client";

/** Error boundary for the AI Employees area (Prompt 003). */
export default function EmployeesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-12 text-center">
      <h2 className="text-base font-semibold text-red-800">
        Something went wrong loading your AI Employees.
      </h2>
      <p className="mt-1 text-sm text-red-700">Please try again.</p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500"
      >
        Retry
      </button>
    </div>
  );
}
