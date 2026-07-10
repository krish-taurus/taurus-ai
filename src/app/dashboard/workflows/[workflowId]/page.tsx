/**
 * Workflow builder + run panel (Sprint 048).
 *
 * Edit the steps, run the workflow, and see recent runs. Managers can build and
 * run; viewers get a read-only view via the list (this page requires manage).
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { getWorkflow, listWorkflowRuns } from "@/modules/workflows/service";
import { WorkflowBuilder, type EmployeeOption } from "@/components/workflows/workflow-builder";
import {
  RunWorkflowForm,
  WorkflowStatusButton,
  DeleteWorkflowButton,
} from "@/components/workflows/workflow-controls";
import { Badge, BackLink, Card, PageHeader } from "@/components/ui";

function runTone(status: string): "soft" | "outline" {
  return status === "succeeded" ? "soft" : "outline";
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function WorkflowBuilderPage({
  params,
}: {
  params: { workflowId: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "workflow.manage")) redirect("/dashboard/workflows");

  const store = getStore();
  const workflow = await getWorkflow(store, organization.id, params.workflowId);
  if (!workflow) notFound();

  const [employees, runs] = await Promise.all([
    store.listEmployees(organization.id),
    listWorkflowRuns(store, organization.id, workflow.id, 10),
  ]);
  const active = employees.filter((e) => e.status !== "archived");
  const readyFlags = await Promise.all(
    active.map((e) => store.getPublishedEmployeeDna(organization.id, e.id).then((d) => Boolean(d))),
  );
  const employeeOptions: EmployeeOption[] = active.map((e, i) => ({
    id: e.id,
    name: e.name,
    roleTitle: e.roleTitle,
    ready: readyFlags[i],
  }));

  return (
    <div className="max-w-3xl">
      <BackLink href="/dashboard/workflows" label="Back to Workflows" />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <PageHeader eyebrow="Workflow" title={workflow.name} description={workflow.description ?? undefined} />
        <div className="flex items-center gap-2 pt-1">
          <Badge tone={workflow.status === "active" ? "soft" : "outline"}>{workflow.status}</Badge>
          <WorkflowStatusButton workflowId={workflow.id} status={workflow.status} />
          <DeleteWorkflowButton workflowId={workflow.id} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Builder */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-taurus-faint">Steps</h2>
          <WorkflowBuilder
            workflowId={workflow.id}
            initialGraph={workflow.graph}
            employees={employeeOptions}
          />
        </div>

        {/* Run + history */}
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-taurus-text">Run now</h2>
            <RunWorkflowForm workflowId={workflow.id} />
            <p className="mt-3 text-xs text-taurus-faint">
              Save your steps before running so the latest version is used.
            </p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-taurus-text">Recent runs</h2>
            {runs.length === 0 ? (
              <p className="text-sm text-taurus-faint">No runs yet. Run the workflow to see results here.</p>
            ) : (
              <ul className="space-y-2">
                {runs.map((run) => (
                  <li key={run.id}>
                    <Link
                      href={`/dashboard/workflows/${workflow.id}/runs/${run.id}`}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-taurus-muted"
                    >
                      <span className="text-taurus-sub">{timeAgo(run.startedAt)}</span>
                      <Badge tone={runTone(run.status)}>{run.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
