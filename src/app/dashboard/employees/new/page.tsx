import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { CreateEmployeeForm } from "@/components/employees/create-employee-form";
import { PageHeader } from "@/components/page-header";

export default async function NewEmployeePage() {
  const { membership } = await requireCurrentOrganization();
  // Least privilege: only roles that may create employees can open this page.
  if (!hasPermission(membership.role, "employee.create")) {
    redirect("/dashboard/employees");
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Hire AI Employee"
        description="Give your new AI Employee a name and role. You can refine everything later."
      />

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <CreateEmployeeForm />
      </div>

      <p className="mt-4 text-sm text-slate-500">
        <Link
          href="/dashboard/employees"
          className="font-medium text-taurus-accent hover:underline"
        >
          ← Back to AI Employees
        </Link>
      </p>
    </div>
  );
}
