/**
 * Workflows service (Sprint 048) — server only.
 *
 * CRUD for workflow definitions plus the entry point that starts a run. All
 * reads/writes are organization-scoped (the store enforces it); the service
 * validates the graph before persisting and before running so the engine only
 * ever sees a well-formed definition. Running is delegated to the engine, which
 * drives each employee through the normal chat governance + billing path.
 */

import type { DataStore } from "@/lib/db/store";
import type {
  Workflow,
  WorkflowGraph,
  WorkflowRun,
  WorkflowRunStep,
  WorkflowRunTriggerSource,
  WorkflowStatus,
} from "@/lib/db/types";
import {
  validateGraphIntegrity,
  workflowDescriptionSchema,
  workflowGraphSchema,
  workflowNameSchema,
} from "@/modules/workflows/schema";
import { runWorkflow, type WorkflowEngineDeps } from "@/modules/workflows/engine";

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

export interface WorkflowActor {
  organizationId: string;
  userId: string | null;
}

/** Validate + normalize a graph, throwing a readable error when it's malformed. */
function assertValidGraph(graph: WorkflowGraph): WorkflowGraph {
  const parsed = workflowGraphSchema.safeParse(graph);
  if (!parsed.success) {
    throw new WorkflowError("This workflow's steps are not valid. Please review and try again.");
  }
  const integrity = validateGraphIntegrity(parsed.data as WorkflowGraph);
  if (integrity) throw new WorkflowError(integrity);
  return parsed.data as WorkflowGraph;
}

export async function listWorkflows(store: DataStore, organizationId: string): Promise<Workflow[]> {
  return store.listWorkflows(organizationId);
}

export async function getWorkflow(
  store: DataStore,
  organizationId: string,
  workflowId: string,
): Promise<Workflow | null> {
  return store.getWorkflow(organizationId, workflowId);
}

export async function createWorkflow(
  store: DataStore,
  actor: WorkflowActor,
  input: { name: string; description?: string | null },
): Promise<Workflow> {
  const name = workflowNameSchema.safeParse(input.name);
  if (!name.success) throw new WorkflowError("Give your workflow a name.");
  const description =
    input.description && input.description.trim()
      ? workflowDescriptionSchema.parse(input.description)
      : null;

  const workflow = await store.createWorkflow({
    organizationId: actor.organizationId,
    name: name.data,
    description,
    status: "draft",
    createdByUserId: actor.userId,
  });
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "workflow.created",
    targetType: "workflow",
    targetId: workflow.id,
    metadata: { name: workflow.name },
  });
  return workflow;
}

export async function updateWorkflowDetails(
  store: DataStore,
  actor: WorkflowActor,
  workflowId: string,
  patch: { name?: string; description?: string | null; graph?: WorkflowGraph },
): Promise<Workflow> {
  const existing = await store.getWorkflow(actor.organizationId, workflowId);
  if (!existing) throw new WorkflowError("This workflow could not be found.");

  const update: { name?: string; description?: string | null; graph?: WorkflowGraph } = {};
  if (patch.name !== undefined) {
    const name = workflowNameSchema.safeParse(patch.name);
    if (!name.success) throw new WorkflowError("Give your workflow a name.");
    update.name = name.data;
  }
  if (patch.description !== undefined) {
    update.description =
      patch.description && patch.description.trim()
        ? workflowDescriptionSchema.parse(patch.description)
        : null;
  }
  if (patch.graph !== undefined) {
    update.graph = assertValidGraph(patch.graph);
  }

  const updated = await store.updateWorkflow(actor.organizationId, workflowId, update);
  if (!updated) throw new WorkflowError("This workflow could not be found.");
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "workflow.updated",
    targetType: "workflow",
    targetId: workflowId,
    metadata: { fields: Object.keys(update) },
  });
  return updated;
}

export async function setWorkflowStatus(
  store: DataStore,
  actor: WorkflowActor,
  workflowId: string,
  status: WorkflowStatus,
): Promise<Workflow> {
  const updated = await store.updateWorkflow(actor.organizationId, workflowId, { status });
  if (!updated) throw new WorkflowError("This workflow could not be found.");
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "workflow.status_changed",
    targetType: "workflow",
    targetId: workflowId,
    metadata: { status },
  });
  return updated;
}

export async function deleteWorkflow(
  store: DataStore,
  actor: WorkflowActor,
  workflowId: string,
): Promise<void> {
  const removed = await store.deleteWorkflow(actor.organizationId, workflowId);
  if (!removed) throw new WorkflowError("This workflow could not be found.");
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "workflow.deleted",
    targetType: "workflow",
    targetId: workflowId,
  });
}

export interface StartWorkflowRunOptions {
  triggeredBy?: WorkflowRunTriggerSource;
  input?: Record<string, unknown>;
}

/**
 * Start a run of a workflow and execute it (inline, Phase 1). Refuses to run an
 * archived or empty workflow with a readable message so nothing silently no-ops.
 */
export async function startWorkflowRun(
  deps: WorkflowEngineDeps,
  actor: WorkflowActor,
  workflowId: string,
  opts: StartWorkflowRunOptions = {},
): Promise<WorkflowRun> {
  const { store } = deps;
  const workflow = await store.getWorkflow(actor.organizationId, workflowId);
  if (!workflow) throw new WorkflowError("This workflow could not be found.");
  if (workflow.status === "archived") {
    throw new WorkflowError("This workflow is archived. Restore it before running.");
  }
  if (!workflow.graph.entryNodeId || workflow.graph.nodes.length === 0) {
    throw new WorkflowError("Add at least one step before running this workflow.");
  }
  // Re-validate stored graph defensively (in case of an out-of-band write).
  assertValidGraph(workflow.graph);

  const organization = await store.getOrganizationById(actor.organizationId);
  const organizationName = organization?.name ?? "our company";

  return runWorkflow(deps, {
    workflow,
    organizationName,
    actor,
    triggeredBy: opts.triggeredBy ?? "manual",
    input: opts.input,
  });
}

export async function listWorkflowRuns(
  store: DataStore,
  organizationId: string,
  workflowId: string,
  limit = 50,
): Promise<WorkflowRun[]> {
  return store.listWorkflowRunsForWorkflow(organizationId, workflowId, limit);
}

export async function getWorkflowRun(
  store: DataStore,
  organizationId: string,
  runId: string,
): Promise<WorkflowRun | null> {
  return store.getWorkflowRun(organizationId, runId);
}

export async function listWorkflowRunSteps(
  store: DataStore,
  organizationId: string,
  runId: string,
): Promise<WorkflowRunStep[]> {
  return store.listWorkflowRunSteps(organizationId, runId);
}
