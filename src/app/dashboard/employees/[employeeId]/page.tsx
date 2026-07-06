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
import { buttonClasses, Card } from "@/components/ui";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "AI";
}

function Placeholder({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-taurus-faint">{label}</p>
      <p className="mt-1 text-sm text-taurus-sub">{value}</p>
    </Card>
  );
}

function StyleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-taurus-faint">{label}</dt>
      <dd className="font-medium text-taurus-text">{value}</dd>
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
  const dnaStatusText = dnaOverview.published
    ? "Published"
    : dnaOverview.draft
      ? "Draft"
      : "Not started";
  const dnaCtaLabel = canEditDna ? "Configure Employee DNA" : "View Employee DNA";

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm">
        <Link
          href="/dashboard/employees"
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← AI Employees
        </Link>
      </p>

      {/* Profile header — reads like an employee profile, not a config page. */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-taurus-line bg-taurus-elevated text-xl font-semibold text-taurus-text">
            {initials(employee.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-taurus-text">
              {employee.name}
            </h1>
            <p className="text-taurus-sub">{employee.roleTitle}</p>
            <p className="mt-1 text-sm text-taurus-faint">
              {employee.department ?? "No department"} · {organization.name}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={employee.status} />
              <VisibilityBadge visibility={employee.visibility} />
            </div>
          </div>
        </div>

        {employee.description ? (
          <p className="mt-5 border-t border-taurus-line pt-5 text-sm text-taurus-sub">
            {employee.description}
          </p>
        ) : null}

        {canManage ? (
          <div className="mt-6 border-t border-taurus-line pt-5">
            <EmployeeActions employee={employee} />
          </div>
        ) : null}
      </Card>

      {/* Responsibilities + working style captured during hiring. */}
      {employee.responsibilities.length > 0 || employee.workingStyle ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {employee.responsibilities.length > 0 ? (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-taurus-text">Responsibilities</h2>
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-taurus-sub">
                {employee.responsibilities.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </Card>
          ) : null}

          {employee.workingStyle ? (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-taurus-text">Working style</h2>
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
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* Employee DNA status + management. */}
      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-taurus-text">Employee DNA</h2>
            <div className="mt-2 flex items-center gap-2">
              {dnaCurrent ? <DnaStatusBadge status={dnaCurrent.status} /> : null}
              <span className="text-sm text-taurus-sub">{dnaStatusText}</span>
            </div>
            {dnaOverview.published ? (
              <p className="mt-1.5 text-xs text-taurus-faint">
                Published Version {dnaOverview.published.versionNumber} · Updated{" "}
                {formatDate(dnaOverview.published.updatedAt)}
              </p>
            ) : dnaCurrent ? (
              <p className="mt-1.5 text-xs text-taurus-faint">
                Updated {formatDate(dnaCurrent.updatedAt)}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-taurus-faint">
                Give this AI Employee a working style, responsibilities, and boundaries.
              </p>
            )}
          </div>
          <Link
            href={`/dashboard/employees/${employee.id}/dna`}
            className={buttonClasses("secondary")}
          >
            {dnaCtaLabel}
          </Link>
        </div>
      </Card>

      {/* Placeholders for capabilities delivered in later prompts. */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Placeholder label="Knowledge Vault" value="0 sources connected" />
        <Placeholder label="Usage" value="No activity recorded yet" />
        <Placeholder label="Recent activity" value="Nothing to show yet" />
      </div>

      <p className="mt-6 text-xs text-taurus-faint">
        Created {formatDate(employee.createdAt)} · Last updated {formatDate(employee.updatedAt)}
      </p>
    </div>
  );
}
