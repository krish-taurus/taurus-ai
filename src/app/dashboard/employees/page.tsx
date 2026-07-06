import Link from "next/link";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { EmployeeCard } from "@/components/employees/employee-card";
import { buttonClasses, EmptyState, PageHeader } from "@/components/ui";

export default async function EmployeesPage() {
  const { organization, membership } = await requireCurrentOrganization();
  const employees = await getStore().listEmployees(organization.id);
  const canHire = hasPermission(membership.role, "employee.create");

  return (
    <div>
      <PageHeader
        title="AI Employees"
        description={`The AI Employees in ${organization.name}.`}
        action={
          canHire && employees.length > 0 ? (
            <Link href="/dashboard/hire" className={buttonClasses("primary")}>
              Hire AI Employee
            </Link>
          ) : undefined
        }
      />

      {employees.length === 0 ? (
        <EmptyState
          title="You have not hired your first AI Employee yet."
          description={
            canHire ? undefined : "Ask an organization admin to hire your first AI Employee."
          }
          action={
            canHire ? (
              <Link href="/dashboard/hire" className={buttonClasses("primary", "lg")}>
                Hire AI Employee
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees.map((employee) => (
            <EmployeeCard key={employee.id} employee={employee} />
          ))}
        </div>
      )}
    </div>
  );
}
