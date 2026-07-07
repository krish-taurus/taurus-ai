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
import { getModel } from "@/modules/model-gateway/catalog";
import { brainModeForRoutingMode, ROUTING_MODE_LABELS } from "@/modules/model-gateway/metadata";
import { computeChatReadiness } from "@/modules/employee-chat/readiness";
import { describeAuditAction } from "@/modules/audit/metadata";
import { ReadinessChecklist } from "@/components/employee-chat/readiness-checklist";
import { buttonClasses, Card } from "@/components/ui";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "AI";
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

  const knowledgeCount = await store.countAssignedKnowledgeForEmployee(
    organization.id,
    employee.id,
  );
  const canManageKnowledge = hasPermission(membership.role, "knowledge.manage");

  const brainSettings = await store.getEmployeeModelSettings(organization.id, employee.id);
  const brainLabel = !brainSettings
    ? "Inherits organization default"
    : brainSettings.modelId
      ? (getModel(brainSettings.modelId)?.displayName ?? "Custom model")
      : brainSettings.routingMode
        ? (brainModeForRoutingMode(brainSettings.routingMode)?.label ??
          ROUTING_MODE_LABELS[brainSettings.routingMode])
        : "Inherits organization default";
  const canManageBrain = hasPermission(membership.role, "model_hub.manage");

  const chatReadiness = await computeChatReadiness(store, {
    organizationId: organization.id,
    employee,
  });
  const canChat = hasPermission(membership.role, "employee_chat.view");

  const canViewChannels = hasPermission(membership.role, "channel.view");
  const channelCount = canViewChannels
    ? (await store.listEmployeeChannelsForEmployee(organization.id, employee.id)).filter(
        (c) => c.status !== "archived",
      ).length
    : 0;

  // Usage + recent activity for this AI Employee. Usage (interaction count) is
  // operational and shown to all roles; the activity trail reuses the audit-view
  // permission (owner/admin) so it isn't exposed more widely than the Audit page.
  const interactionCount = await store.countInteractionsForEmployee(organization.id, employee.id);
  const canViewActivity = hasPermission(membership.role, "audit.view");
  const recentActivity = canViewActivity
    ? await store.listAuditEventsForEmployee(organization.id, employee.id, 4)
    : [];

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
          {canChat ? (
            <Link
              href={`/dashboard/employees/${employee.id}/chat`}
              className={buttonClasses("primary", "md", "shrink-0")}
            >
              Test Chat
            </Link>
          ) : null}
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

      {/* Knowledge Vault status + management. */}
      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-taurus-text">Knowledge Vault</h2>
            <p className="mt-1.5 text-sm text-taurus-sub">
              {knowledgeCount} {knowledgeCount === 1 ? "source" : "sources"} assigned
            </p>
            <p className="mt-1.5 text-xs text-taurus-faint">
              Give this AI Employee trusted company knowledge to work with.
            </p>
          </div>
          <Link
            href={`/dashboard/employees/${employee.id}/knowledge`}
            className={buttonClasses("secondary")}
          >
            {canManageKnowledge ? "Manage knowledge" : "View knowledge"}
          </Link>
        </div>
      </Card>

      {/* Employee Brain (Model Hub) status + management. */}
      <Card className="mt-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-taurus-text">Employee Brain</h2>
            <p className="mt-1.5 text-sm text-taurus-sub">{brainLabel}</p>
            <p className="mt-1.5 text-xs text-taurus-faint">
              Choose how much quality, speed, and cost this AI Employee should favor.
            </p>
          </div>
          <Link
            href={`/dashboard/employees/${employee.id}/brain`}
            className={buttonClasses("secondary")}
          >
            {canManageBrain ? "Manage Employee Brain" : "View Employee Brain"}
          </Link>
        </div>
      </Card>

      {/* Chat readiness checklist + Test Chat. */}
      {canChat ? (
        <Card className="mt-6 p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-taurus-text">Ready to chat?</h2>
              <p className="mt-1.5 text-xs text-taurus-faint">
                Test this AI Employee once these are in place.
              </p>
            </div>
            <Link
              href={`/dashboard/employees/${employee.id}/chat`}
              className={buttonClasses(chatReadiness.canChat ? "primary" : "secondary")}
            >
              Test Chat
            </Link>
          </div>
          <ReadinessChecklist readiness={chatReadiness} employeeId={employee.id} />
        </Card>
      ) : null}

      {/* Connections — deploy this AI Employee outside the dashboard. */}
      {canViewChannels ? (
        <Card className="mt-6 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-taurus-text">Connections</h2>
              <p className="mt-1.5 text-sm text-taurus-sub">
                {channelCount > 0
                  ? `${channelCount} connection${channelCount === 1 ? "" : "s"} configured`
                  : "Not deployed yet"}
              </p>
              <p className="mt-1.5 text-xs text-taurus-faint">
                Deploy this AI Employee to your website, messaging, email, and calls.
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <Link
                href={`/dashboard/employees/${employee.id}/channels`}
                className={buttonClasses("secondary")}
              >
                {canManage ? "Manage connections" : "View connections"}
              </Link>
              <Link
                href={`/dashboard/connections?employee=${employee.id}`}
                className="text-center text-xs font-medium text-taurus-sub hover:text-taurus-text"
              >
                View in all Connections
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Usage + recent activity — real, organization-scoped data. */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-taurus-faint">Usage</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-taurus-text">
            {interactionCount.toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-taurus-faint">
            {interactionCount === 1 ? "AI Employee interaction" : "AI Employee interactions"}
          </p>
        </Card>

        {canViewActivity ? (
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-taurus-faint">
              Recent activity
            </p>
            {recentActivity.length === 0 ? (
              <p className="mt-1 text-sm text-taurus-sub">Nothing to show yet</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {recentActivity.map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-taurus-sub">
                      {describeAuditAction(event.action)}
                    </span>
                    <time dateTime={event.createdAt} className="shrink-0 text-xs text-taurus-faint">
                      {formatDate(event.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
      </div>

      <p className="mt-6 text-xs text-taurus-faint">
        Created {formatDate(employee.createdAt)} · Last updated {formatDate(employee.updatedAt)}
      </p>
    </div>
  );
}
