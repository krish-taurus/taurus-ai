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
          className="font-medium text-taurus-accent hover:underline"
        >
          ← Back to {employee.name}
        </Link>
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Employee DNA</h1>
            <p className="mt-1 text-sm text-slate-600">
              Define {employee.name}&apos;s working style, responsibilities, and boundaries — like
              an employee handbook.
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              {currentVersion ? <DnaStatusBadge status={currentVersion.status} /> : null}
              <span className="text-sm font-medium text-slate-700">{statusText}</span>
            </div>
            {currentVersion ? (
              <p className="mt-1 text-xs text-slate-400">
                Version {currentVersion.versionNumber} · Updated{" "}
                {formatDate(currentVersion.updatedAt)}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {searchParams?.saved ? (
        <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          Draft saved.
        </p>
      ) : null}
      {searchParams?.published ? (
        <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          Employee DNA published.
        </p>
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
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-600">
            This AI Employee does not have published DNA yet. An organization admin or builder can
            add it.
          </div>
        )}
      </div>

      {/* Read-only view of the currently published DNA, if any. */}
      {overview.published && canEdit ? (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Currently published · Version {overview.published.versionNumber}
          </h2>
          <DnaSummary dna={overview.published.dna} />
        </div>
      ) : null}

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Version history</h2>
        <DnaVersionHistory
          versions={overview.versions}
          employeeId={employee.id}
          canManage={canPublish}
        />
      </div>
    </div>
  );
}
