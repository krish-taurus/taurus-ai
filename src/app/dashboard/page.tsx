import Link from "next/link";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { EmployeeCard } from "@/components/employees/employee-card";
import { buttonClasses, EmptyState, PageHeader, SectionHeader, StatCard } from "@/components/ui";

export default async function DashboardPage() {
  const { organization, membership } = await requireCurrentOrganization();
  const store = getStore();
  const employees = await store.listEmployees(organization.id);
  const canHire = hasPermission(membership.role, "employee.create");
  const preview = employees.slice(0, 3);

  const activeCount = employees.filter((e) => e.status === "active").length;
  const draftCount = employees.filter((e) => e.status === "draft").length;

  const knowledge = await store.getKnowledgeVaultOverview(organization.id);
  const canViewKnowledge = hasPermission(membership.role, "knowledge.view");
  const canManageKnowledge = hasPermission(membership.role, "knowledge.manage");

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title={organization.name}
        description="Your AI workforce at a glance."
        action={
          canHire ? (
            <Link href="/dashboard/hire" className={buttonClasses("primary")}>
              Hire AI Employee
            </Link>
          ) : undefined
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="AI Employees" value={employees.length} />
        <StatCard label="Active" value={activeCount} />
        <StatCard label="In draft" value={draftCount} />
      </div>

      <section>
        <SectionHeader
          title="AI Employees"
          action={
            employees.length > 0 ? (
              <Link
                href="/dashboard/employees"
                className="text-sm font-medium text-taurus-sub hover:text-taurus-text"
              >
                View all ({employees.length})
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
            {preview.map((employee) => (
              <EmployeeCard key={employee.id} employee={employee} />
            ))}
          </div>
        )}
      </section>

      {canViewKnowledge ? (
        <section className="mt-10">
          <SectionHeader
            title="Knowledge Vault"
            action={
              knowledge.total > 0 ? (
                <Link
                  href="/dashboard/knowledge"
                  className="text-sm font-medium text-taurus-sub hover:text-taurus-text"
                >
                  Open Knowledge Vault
                </Link>
              ) : undefined
            }
          />

          {knowledge.total === 0 ? (
            <EmptyState
              title="Your Knowledge Vault is empty."
              description={
                canManageKnowledge
                  ? "Add company knowledge your AI Employees can use."
                  : "Ask an organization admin to add company knowledge."
              }
              action={
                canManageKnowledge ? (
                  <Link href="/dashboard/knowledge/new" className={buttonClasses("primary", "lg")}>
                    Add Knowledge
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Sources" value={knowledge.total} />
              <StatCard label="Ready" value={knowledge.ready} />
              <StatCard label="Assigned" value={knowledge.assigned} />
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
