import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Overview" />

      {/* Empty state — exact copy required by Prompt 001. */}
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <p className="mx-auto max-w-md text-base text-slate-700">
          You have not hired any AI employees yet. Hire your first AI employee in five minutes.
        </p>
        <div className="mt-6">
          <Link
            href="/dashboard/employees/new"
            className="inline-flex items-center rounded-md bg-taurus-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
          >
            Hire AI Employee
          </Link>
        </div>
      </div>
    </div>
  );
}
