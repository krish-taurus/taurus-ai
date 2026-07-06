import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { AssignKnowledgePanel } from "@/components/knowledge/assign-knowledge-panel";
import { buttonClasses, PageHeader } from "@/components/ui";

export default async function EmployeeKnowledgePage({
  params,
}: {
  params: { employeeId: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "knowledge.view")) {
    redirect(`/dashboard/employees/${params.employeeId}`);
  }

  const store = getStore();
  const employee = await store.getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  const canManage = hasPermission(membership.role, "knowledge.manage");
  const allSources = (await store.listKnowledgeSources(organization.id)).filter(
    (s) => s.status !== "archived",
  );
  const assigned = await store.listKnowledgeSourcesForEmployee(organization.id, employee.id);
  const assignedIds = new Set(assigned.map((s) => s.id));

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm">
        <Link
          href={`/dashboard/employees/${employee.id}`}
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← Back to {employee.name}
        </Link>
      </p>

      <PageHeader
        eyebrow="Knowledge Vault"
        title={`${employee.name}'s knowledge`}
        description="Choose which company knowledge this AI Employee can use."
        action={
          canManage ? (
            <Link href="/dashboard/knowledge/new" className={buttonClasses("secondary")}>
              Add Knowledge
            </Link>
          ) : undefined
        }
      />

      <p className="mb-4 text-sm text-taurus-sub">
        {assignedIds.size} of {allSources.length} sources assigned.
      </p>

      <AssignKnowledgePanel
        employeeId={employee.id}
        sources={allSources}
        assignedIds={assignedIds}
        canManage={canManage}
      />
    </div>
  );
}
