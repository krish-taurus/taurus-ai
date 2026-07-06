import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { formatDate } from "@/lib/format";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { StatusBadge, VisibilityBadge } from "@/components/employees/employee-badges";
import { EmployeeActions } from "@/components/employees/employee-actions";
import { DnaStatusBadge } from "@/components/employee-dna/dna-version-history";
import {
  ESCALATION_LABELS,
  FORMALITY_LABELS,
  RISK_LABELS,
  TONE_LABELS,
} from "@/modules/employees/hiring-templates";

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

function StyleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}

export default async function EmployeeDetailPage({ params }: { params: { employeeId: string } }) {
  const { organization, membership } = await requireCurrentOrganization();
  const store = getStore();
  // Organization-scoped read: an employee from another organization returns null.
  const employee = await store.getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  const canManage = hasPermission(membership.role, "employee.manage");
  const canEditDna = hasPermission(membership.role, "employee_dna.edit");

  const dnaOverview = await store.getEmployeeDnaOverview(organization.id, employee.id);
  const dnaCurrent = dnaOverview.published ?? dnaOverview.draft ?? null;
  const hasDna = Boolean(dnaOverview.published || dnaOverview.draft);
  const dnaStatusText = dnaOverview.published
    ? "Published"
    : dnaOverview.draft
      ? "Draft"
      : "Not started";
  const dnaCtaLabel = !hasDna
    ? canEditDna
      ? "Add Employee DNA"
      : "View Employee DNA"
    : canEditDna
      ? "Edit Employee DNA"
      : "View Employee DNA";

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

      {/* Responsibilities + working style captured during hiring. */}
      {employee.responsibilities.length > 0 || employee.workingStyle ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {employee.responsibilities.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Responsibilities</h2>
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-700">
                {employee.responsibilities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {employee.workingStyle ? (
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Working style</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <StyleRow label="Tone" value={TONE_LABELS[employee.workingStyle.tone]} />
                <StyleRow
                  label="Formality"
                  value={FORMALITY_LABELS[employee.workingStyle.formality]}
                />
                <StyleRow label="Risk level" value={RISK_LABELS[employee.workingStyle.riskLevel]} />
                <StyleRow
                  label="Escalation"
                  value={ESCALATION_LABELS[employee.workingStyle.escalation]}
                />
              </dl>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Employee DNA status + management. */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Employee DNA</h2>
            <div className="mt-2 flex items-center gap-2">
              {dnaCurrent ? <DnaStatusBadge status={dnaCurrent.status} /> : null}
              <span className="text-sm text-slate-600">{dnaStatusText}</span>
            </div>
            {dnaOverview.published ? (
              <p className="mt-1 text-xs text-slate-400">
                Published Version {dnaOverview.published.versionNumber} · Updated{" "}
                {formatDate(dnaOverview.published.updatedAt)}
              </p>
            ) : dnaCurrent ? (
              <p className="mt-1 text-xs text-slate-400">
                Updated {formatDate(dnaCurrent.updatedAt)}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                Give this AI Employee a working style, responsibilities, and boundaries.
              </p>
            )}
          </div>
          <Link
            href={`/dashboard/employees/${employee.id}/dna`}
            className="shrink-0 rounded-md bg-taurus-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
          >
            {dnaCtaLabel}
          </Link>
        </div>
      </div>

      {/* Placeholders for capabilities delivered in later prompts. */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
