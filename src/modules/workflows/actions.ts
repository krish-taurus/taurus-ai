"use server";

/**
 * Workflow server actions (Sprint 048).
 *
 * Thin `"use server"` wrappers: resolve the org + role, gate on the workflow
 * permission, call the service, then revalidate/redirect. The builder submits
 * the whole graph as a JSON field; the service validates it before saving.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { createLlmGateway, isProductionRuntime } from "@/modules/model-gateway/credential-resolver";
import type { WorkflowGraph } from "@/lib/db/types";
import {
  createWorkflow,
  updateWorkflowDetails,
  setWorkflowStatus,
  setWorkflowTrigger,
  deleteWorkflow,
  startWorkflowRun,
  WorkflowError,
} from "@/modules/workflows/service";

export interface WorkflowActionState {
  error?: string;
  ok?: boolean;
}

const DENIED = "You do not have permission to manage workflows.";

function messageFor(err: unknown): string {
  if (err instanceof WorkflowError) return err.message;
  return "Something went wrong. Please try again.";
}

export async function createWorkflowAction(
  _prev: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "workflow.manage")) return { error: DENIED };

  let workflowId: string;
  try {
    const workflow = await createWorkflow(
      getStore(),
      { organizationId: organization.id, userId: user.id },
      {
        name: String(formData.get("name") ?? ""),
        description: (formData.get("description") as string) || null,
      },
    );
    workflowId = workflow.id;
  } catch (err) {
    return { error: messageFor(err) };
  }
  revalidatePath("/dashboard/workflows");
  redirect(`/dashboard/workflows/${workflowId}`);
}

export async function saveWorkflowAction(
  _prev: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "workflow.manage")) return { error: DENIED };

  const workflowId = String(formData.get("workflowId") ?? "");
  let graph: WorkflowGraph | undefined;
  const graphRaw = formData.get("graph");
  if (typeof graphRaw === "string" && graphRaw.trim()) {
    try {
      graph = JSON.parse(graphRaw) as WorkflowGraph;
    } catch {
      return { error: "The workflow steps could not be saved. Please try again." };
    }
  }

  try {
    await updateWorkflowDetails(
      getStore(),
      { organizationId: organization.id, userId: user.id },
      workflowId,
      {
        name: formData.has("name") ? String(formData.get("name") ?? "") : undefined,
        description: formData.has("description")
          ? (formData.get("description") as string) || null
          : undefined,
        graph,
      },
    );
  } catch (err) {
    return { error: messageFor(err) };
  }
  revalidatePath(`/dashboard/workflows/${workflowId}`);
  return { ok: true };
}

export async function setWorkflowStatusAction(
  _prev: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "workflow.manage")) return { error: DENIED };

  const workflowId = String(formData.get("workflowId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "draft" && status !== "active" && status !== "paused" && status !== "archived") {
    return { error: "That status is not valid." };
  }
  try {
    await setWorkflowStatus(
      getStore(),
      { organizationId: organization.id, userId: user.id },
      workflowId,
      status,
    );
  } catch (err) {
    return { error: messageFor(err) };
  }
  revalidatePath("/dashboard/workflows");
  revalidatePath(`/dashboard/workflows/${workflowId}`);
  return { ok: true };
}

export async function setWorkflowTriggerAction(
  _prev: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "workflow.manage")) return { error: DENIED };

  const workflowId = String(formData.get("workflowId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "manual" && kind !== "webhook") return { error: "That trigger is not valid." };
  try {
    await setWorkflowTrigger(
      getStore(),
      { organizationId: organization.id, userId: user.id },
      workflowId,
      kind,
    );
  } catch (err) {
    return { error: messageFor(err) };
  }
  revalidatePath(`/dashboard/workflows/${workflowId}`);
  return { ok: true };
}

export async function deleteWorkflowAction(
  _prev: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "workflow.manage")) return { error: DENIED };

  const workflowId = String(formData.get("workflowId") ?? "");
  try {
    await deleteWorkflow(
      getStore(),
      { organizationId: organization.id, userId: user.id },
      workflowId,
    );
  } catch (err) {
    return { error: messageFor(err) };
  }
  revalidatePath("/dashboard/workflows");
  redirect("/dashboard/workflows");
}

export async function runWorkflowAction(
  _prev: WorkflowActionState,
  formData: FormData,
): Promise<WorkflowActionState> {
  const { user, organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "workflow.manage")) return { error: DENIED };

  const workflowId = String(formData.get("workflowId") ?? "");
  const message = String(formData.get("message") ?? "");
  const store = getStore();
  let runId: string;
  try {
    const run = await startWorkflowRun(
      { store, gateway: createLlmGateway(store), isProduction: isProductionRuntime },
      { organizationId: organization.id, userId: user.id },
      workflowId,
      { triggeredBy: "manual", input: { message } },
    );
    runId = run.id;
  } catch (err) {
    return { error: messageFor(err) };
  }
  revalidatePath(`/dashboard/workflows/${workflowId}`);
  redirect(`/dashboard/workflows/${workflowId}/runs/${runId}`);
}
