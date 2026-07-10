/**
 * Workflows — list + create (Sprint 048).
 *
 * Workflows chain AI Employees together: a trigger starts a run and each step's
 * output feeds the next. This page lists an organization's workflows and lets a
 * manager start a new one.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { listWorkflows } from "@/modules/workflows/service";
import type { WorkflowStatus } from "@/lib/db/types";
import { CreateWorkflowForm } from "@/components/workflows/create-workflow";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

function statusTone(status: WorkflowStatus): "soft" | "outline" {
  return status === "active" ? "soft" : "outline";
}

export default async function WorkflowsPage() {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "workflow.view")) redirect("/dashboard");
  const canManage = hasPermission(membership.role, "workflow.manage");

  const workflows = await listWorkflows(getStore(), organization.id);

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Automation"
        title="Workflows"
        description="Chain your AI Employees together — a trigger starts a run and each step hands its result to the next."
      />

      {canManage ? (
        <Card className="mb-8 p-6">
          <h2 className="mb-4 text-base font-semibold text-taurus-text">New workflow</h2>
          <CreateWorkflowForm />
        </Card>
      ) : null}

      {workflows.length === 0 ? (
        <EmptyState
          title="No workflows yet."
          description="Create a workflow to have one AI Employee hand work off to the next automatically."
        />
      ) : (
        <Card className="divide-y divide-taurus-line overflow-hidden p-0">
          <ul>
            {workflows.map((wf) => (
              <li key={wf.id}>
                <Link
                  href={`/dashboard/workflows/${wf.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 hover:bg-taurus-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-taurus-text">{wf.name}</p>
                    <p className="truncate text-xs text-taurus-faint">
                      {wf.description || `${wf.graph.nodes.length} step${wf.graph.nodes.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <Badge tone={statusTone(wf.status)}>{wf.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
