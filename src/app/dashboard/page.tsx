import Link from "next/link";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { EmployeeCard } from "@/components/employees/employee-card";
import { PageHeader } from "@/components/page-header";

export default async function DashboardPage() {
  const { organization, membership } = await requireCurrentOrganization();
  const employees = await getStore().listEmployees(organization.id);
  const canHire = hasPermission(membership.role, "employee.create");
  const preview = employees.slice(0, 3);

  return (
    <div>
      <PageHeader title="Overview" description={`Welcome to ${organization.name}.`} />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">AI Employees</h2>
          {employees.length > 0 ? (
            <Link
              href="/dashboard/employees"
              className="text-sm font-medium text-taurus-accent hover:underline"
            >
              View all ({employees.length})
            </Link>
          ) : null}
        </div>

        {employees.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <p className="mx-auto max-w-md text-base text-slate-700">
              You have not hired your first AI Employee yet.
            </p>
            {canHire ? (
              <div className="mt-6">
                <Link
                  href="/dashboard/employees/new"
                  className="inline-flex items-center rounded-md bg-taurus-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
                >
                  Hire AI Employee
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Ask an organization admin to hire your first AI Employee.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {preview.map((employee) => (
              <EmployeeCard key={employee.id} employee={employee} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
