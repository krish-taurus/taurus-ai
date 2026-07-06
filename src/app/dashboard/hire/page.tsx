import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { HiringStudio } from "@/components/hiring/hiring-studio";
import { Card, PageHeader } from "@/components/ui";

export default async function HirePage() {
  const { organization, membership } = await requireCurrentOrganization();
  // Least privilege: only roles that may create employees can open the studio.
  if (!hasPermission(membership.role, "employee.create")) {
    redirect("/dashboard/employees");
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Hiring Studio"
        title={`Hire a new AI Employee`}
        description={`Bring on an AI Employee for ${organization.name} in a few simple steps.`}
      />

      <Card className="p-6 sm:p-8">
        <HiringStudio />
      </Card>

      <p className="mt-4 text-sm">
        <Link
          href="/dashboard/employees"
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← Back to AI Employees
        </Link>
      </p>
    </div>
  );
}
