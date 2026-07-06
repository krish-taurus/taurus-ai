import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { formatDate } from "@/lib/format";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { StatusBadge, VisibilityBadge } from "@/components/employees/employee-badges";
import { EmployeeActions } from "@/components/employees/employee-actions";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "AI";
}

function Placeholder({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{value}</p>
    </div>
  );
}

export default async function EmployeeDetailPage({ params }: { params: { employeeId: string } }) {
  const { organization, membership } = await requireCurrentOrganization();
  // Organization-scoped read: an employee from another organization returns null.
  const employee = await getStore().getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  const canManage = hasPermission(membership.role, "employee.manage");

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm">
        <Link
          href="/dashboard/employees"
          className="font-medium text-taurus-accent hover:underline"
        >
          ← AI Employees
        </Link>
      </p>

      {/* Profile header — reads like an employee profile, not a bot config page. */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-taurus-accent/10 text-xl font-semibold text-taurus-accent">
            {initials(employee.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-slate-900">{employee.name}</h1>
            <p className="text-slate-600">{employee.roleTitle}</p>
            <p className="mt-1 text-sm text-slate-500">
              {employee.department ?? "No department"} · {organization.name}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={employee.status} />
              <VisibilityBadge visibility={employee.visibility} />
            </div>
          </div>
        </div>

        {employee.description ? (
          <p className="mt-5 border-t border-slate-100 pt-5 text-sm text-slate-700">
            {employee.description}
          </p>
        ) : null}

        {canManage ? (
          <div className="mt-6 border-t border-slate-100 pt-5">
            <EmployeeActions employee={employee} />
          </div>
        ) : null}
      </div>

      {/* Placeholders for capabilities delivered in later prompts. */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Placeholder label="Employee DNA" value="No active version yet" />
        <Placeholder label="Knowledge Vault" value="0 sources connected" />
        <Placeholder label="Usage" value="No activity recorded yet" />
        <Placeholder label="Recent activity" value="Nothing to show yet" />
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Created {formatDate(employee.createdAt)} · Last updated {formatDate(employee.updatedAt)}
      </p>
    </div>
  );
}
