import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { EditEmployeeForm } from "@/components/employees/edit-employee-form";
import { Card, PageHeader } from "@/components/ui";

export default async function EditEmployeePage({ params }: { params: { employeeId: string } }) {
  const { organization, membership } = await requireCurrentOrganization();

  // Least privilege: editing requires the employee.manage permission.
  if (!hasPermission(membership.role, "employee.manage")) {
    redirect(`/dashboard/employees/${params.employeeId}`);
  }

  const employee = await getStore().getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  return (
    <div className="max-w-2xl">
      <p className="mb-4 text-sm">
        <Link
          href={`/dashboard/employees/${employee.id}`}
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← Back to profile
        </Link>
      </p>

      <PageHeader
        title={`Edit ${employee.name}`}
        description="Update this AI Employee's profile."
      />

      <Card className="p-6">
        <EditEmployeeForm employee={employee} />
      </Card>
    </div>
  );
}
