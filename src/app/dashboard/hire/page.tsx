import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { HiringStudio } from "@/components/hiring/hiring-studio";
import { PageHeader } from "@/components/page-header";

export default async function HirePage() {
  const { organization, membership } = await requireCurrentOrganization();
  // Least privilege: only roles that may create employees can open the studio.
  if (!hasPermission(membership.role, "employee.create")) {
    redirect("/dashboard/employees");
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Hiring Studio"
        description={`Hire a new AI Employee for ${organization.name} in a few simple steps.`}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <HiringStudio />
      </div>

      <p className="mt-4 text-sm">
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
