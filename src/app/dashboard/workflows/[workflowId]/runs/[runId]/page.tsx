/**
 * Workflow run detail (Sprint 048).
 *
 * The full trace of one run: overall result plus each step's input, output and
 * status, in execution order — so a manager can see exactly how the AI Employees
 * handed off and where a run stopped.
 */

import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { getWorkflow, getWorkflowRun, listWorkflowRunSteps } from "@/modules/workflows/service";
import type { WorkflowRunStep } from "@/lib/db/types";
import { Badge, BackLink, Card, PageHeader } from "@/components/ui";

function stepTone(status: WorkflowRunStep["status"]): "soft" | "outline" {
  return status === "succeeded" ? "soft" : "outline";
}

function stepKind(step: WorkflowRunStep): string {
  switch (step.nodeType) {
    case "employee":
      return "AI Employee";
    case "condition":
      return "Branch";
    case "send_message":
      return "Send message";
    case "sub_workflow":
      return "Run workflow";
    case "transform":
      return "Format";
    default:
      return "Trigger";
  }
}

export default async function WorkflowRunPage({
  params,
}: {
  params: { workflowId: string; runId: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "workflow.view")) redirect("/dashboard");

  const store = getStore();
  const [workflow, run] = await Promise.all([
    getWorkflow(store, organization.id, params.workflowId),
    getWorkflowRun(store, organization.id, params.runId),
  ]);
  if (!workflow || !run || run.workflowId !== workflow.id) notFound();

  const steps = await listWorkflowRunSteps(store, organization.id, run.id);
  const employees = await store.listEmployees(organization.id);
  const nameFor = (id: string | null) => (id ? employees.find((e) => e.id === id)?.name ?? "AI Employee" : null);

  return (
    <div className="max-w-3xl">
      <BackLink href={`/dashboard/workflows/${workflow.id}`} label={`Back to ${workflow.name}`} />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="Workflow run"
          title={workflow.name}
          description={`Started ${new Date(run.startedAt).toLocaleString()}`}
        />
        <Badge tone={run.status === "succeeded" ? "soft" : "outline"}>{run.status}</Badge>
      </div>

      {/* Summary */}
      <Card className="mb-6 mt-4 p-5">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-wide text-taurus-faint">Steps run</div>
            <div className="mt-1 font-medium text-taurus-text">{run.stepCount}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-taurus-faint">Trigger</div>
            <div className="mt-1 font-medium capitalize text-taurus-text">{run.triggeredBy}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-taurus-faint">Result</div>
            <div className="mt-1 font-medium capitalize text-taurus-text">{run.status}</div>
          </div>
        </div>
        {run.error ? (
          <p className="mt-4 rounded-md border border-taurus-line bg-taurus-muted px-3 py-2 text-sm text-taurus-text">
            {run.error}
          </p>
        ) : run.output ? (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-taurus-faint">Final output</div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-taurus-text">{run.output}</p>
          </div>
        ) : null}
      </Card>

      {/* Step trace */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-taurus-faint">Trace</h2>
      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.id}>
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-taurus-muted text-xs font-semibold text-taurus-sub">
                    {step.sequence + 1}
                  </span>
                  <span className="text-sm font-semibold text-taurus-text">
                    {stepKind(step)}
                    {nameFor(step.employeeId) ? ` · ${nameFor(step.employeeId)}` : ""}
                  </span>
                </div>
                <Badge tone={stepTone(step.status)}>{step.status}</Badge>
              </div>
              {step.input ? (
                <div className="mt-2">
                  <div className="text-xs uppercase tracking-wide text-taurus-faint">Input</div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-taurus-sub">{step.input}</p>
                </div>
              ) : null}
              {step.output ? (
                <div className="mt-2">
                  <div className="text-xs uppercase tracking-wide text-taurus-faint">Output</div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-taurus-text">{step.output}</p>
                </div>
              ) : null}
              {step.error ? (
                <p className="mt-2 rounded-md border border-taurus-line bg-taurus-muted px-3 py-2 text-sm text-taurus-text">
                  {step.error}
                </p>
              ) : null}
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
