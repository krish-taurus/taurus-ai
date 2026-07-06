import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { formatDate } from "@/lib/format";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { getDnaOverview } from "@/modules/employee-dna/service";
import { buildDnaPrefill } from "@/modules/employee-dna/prefill";
import { computeDnaCompletion } from "@/modules/employee-dna/scoring";
import { DnaEditor } from "@/components/employee-dna/dna-editor";
import { DnaSummary } from "@/components/employee-dna/dna-summary";
import { DnaCompletionCard } from "@/components/employee-dna/dna-completion";
import { DnaStatusBadge, DnaVersionHistory } from "@/components/employee-dna/dna-version-history";
import { Card, Notice, SectionHeader } from "@/components/ui";

export default async function EmployeeDnaPage({
  params,
  searchParams,
}: {
  params: { employeeId: string };
  searchParams?: { saved?: string; published?: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();

  // Viewing DNA requires permission to view the employee.
  if (!hasPermission(membership.role, "employee.view")) {
    redirect("/dashboard/employees");
  }

  // Organization-scoped read: an employee from another organization returns null.
  const employee = await getStore().getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  const overview = await getDnaOverview(getStore(), organization.id, params.employeeId);
  const canEdit = hasPermission(membership.role, "employee_dna.edit");
  const canPublish = hasPermission(membership.role, "employee.manage");

  // Seed the editor from the working draft, else the published version, else a
  // fresh prefill from the employee. The prefill is NOT persisted until saved.
  const seedDna = overview.draft?.dna ?? overview.published?.dna ?? buildDnaPrefill(employee);
  const completion = computeDnaCompletion(seedDna);

  const statusText = overview.published ? "Published" : overview.draft ? "Draft" : "Not started";
  const currentVersion = overview.draft ?? overview.published ?? null;

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

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-taurus-text">Employee DNA</h1>
            <p className="mt-1.5 text-sm text-taurus-sub">
              Define {employee.name}&apos;s working style, responsibilities, and boundaries — like
              an employee handbook.
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              {currentVersion ? <DnaStatusBadge status={currentVersion.status} /> : null}
              {!currentVersion ? (
                <span className="text-sm font-medium text-taurus-sub">{statusText}</span>
              ) : null}
            </div>
            {currentVersion ? (
              <p className="mt-1.5 text-xs text-taurus-faint">
                Version {currentVersion.versionNumber} · Updated{" "}
                {formatDate(currentVersion.updatedAt)}
              </p>
            ) : null}
          </div>
        </div>
      </Card>

      {searchParams?.saved ? (
        <div className="mt-4">
          <Notice>Draft saved.</Notice>
        </div>
      ) : null}
      {searchParams?.published ? (
        <div className="mt-4">
          <Notice>Employee DNA published.</Notice>
        </div>
      ) : null}

      <div className="mt-6">
        <DnaCompletionCard completion={completion} />
      </div>

      {/* Editor for those who can edit; read-only for everyone else. */}
      <div className="mt-6">
        {canEdit ? (
          <DnaEditor employeeId={employee.id} initialDna={seedDna} canPublish={canPublish} />
        ) : overview.published ? (
          <DnaSummary dna={overview.published.dna} />
        ) : (
          <div className="rounded-lg border border-dashed border-taurus-line bg-taurus-surface p-6 text-sm text-taurus-sub">
            This AI Employee does not have published DNA yet. An organization admin or builder can
            add it.
          </div>
        )}
      </div>

      {/* Read-only view of the currently published DNA, if any. */}
      {overview.published && canEdit ? (
        <div className="mt-8">
          <SectionHeader
            title={`Currently published · Version ${overview.published.versionNumber}`}
          />
          <DnaSummary dna={overview.published.dna} />
        </div>
      ) : null}

      <div className="mt-8">
        <SectionHeader title="Version history" />
        <DnaVersionHistory
          versions={overview.versions}
          employeeId={employee.id}
          canManage={canPublish}
        />
      </div>
    </div>
  );
}
