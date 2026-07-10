/**
 * Workflows service (Sprint 048) — server only.
 *
 * CRUD for workflow definitions plus the entry point that starts a run. All
 * reads/writes are organization-scoped (the store enforces it); the service
 * validates the graph before persisting and before running so the engine only
 * ever sees a well-formed definition. Running is delegated to the engine, which
 * drives each employee through the normal chat governance + billing path.
 */

import { randomUUID } from "node:crypto";
import type { DataStore } from "@/lib/db/store";
import type {
  Workflow,
  WorkflowGraph,
  WorkflowRun,
  WorkflowRunStep,
  WorkflowRunTriggerSource,
  WorkflowStatus,
  WorkflowTrigger,
} from "@/lib/db/types";
import {
  validateGraphIntegrity,
  workflowDescriptionSchema,
  workflowGraphSchema,
  workflowNameSchema,
  SCHEDULE_MIN_MINUTES,
} from "@/modules/workflows/schema";
import { runWorkflow, resumeRun, type WorkflowEngineDeps } from "@/modules/workflows/engine";

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

/** A URL-safe webhook token (32 hex chars). */
function newWebhookToken(): string {
  return randomUUID().replace(/-/g, "");
}

export interface SetTriggerInput {
  kind: "manual" | "webhook" | "schedule" | "channel";
  /** For schedule: run cadence in minutes. */
  everyMinutes?: number;
  /** For channel: the connected channel whose inbound messages start the run. */
  channelId?: string;
}

/**
 * Set how a workflow starts. Enabling webhook mints a stable secret token;
 * schedule stores a cadence + the next due time; channel binds it to an inbound
 * channel. Returns the updated workflow so the caller can show the new URL/state.
 */
export async function setWorkflowTrigger(
  store: DataStore,
  actor: WorkflowActor,
  workflowId: string,
  input: SetTriggerInput,
): Promise<Workflow> {
  const existing = await store.getWorkflow(actor.organizationId, workflowId);
  if (!existing) throw new WorkflowError("This workflow could not be found.");

  let trigger: WorkflowTrigger;
  if (input.kind === "webhook") {
    trigger = {
      type: "webhook",
      // Reuse the token if one already exists so the URL is stable.
      token: existing.trigger.type === "webhook" ? existing.trigger.token : newWebhookToken(),
    };
  } else if (input.kind === "schedule") {
    const everyMinutes = Math.max(SCHEDULE_MIN_MINUTES, Math.floor(input.everyMinutes ?? 60));
    trigger = {
      type: "schedule",
      everyMinutes,
      nextRunAt: new Date(Date.now() + everyMinutes * 60_000).toISOString(),
    };
  } else if (input.kind === "channel") {
    if (!input.channelId) throw new WorkflowError("Choose a channel for this trigger.");
    trigger = { type: "channel", channelId: input.channelId };
  } else {
    trigger = { type: "manual" };
  }

  const updated = await store.updateWorkflow(actor.organizationId, workflowId, { trigger });
  if (!updated) throw new WorkflowError("This workflow could not be found.");
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: "workflow.trigger_changed",
    targetType: "workflow",
    targetId: workflowId,
    metadata: { trigger: input.kind },
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

export type WebhookRunResult =
  | { ok: true; run: WorkflowRun }
  | { ok: false; reason: "not_found" | "inactive" | "empty" };

/**
 * Run a workflow triggered by its webhook token (unauthenticated — the token is
 * the secret). Only ACTIVE workflows fire, so a paused/draft webhook is inert.
 * The run executes as a system actor under the workflow's own organization.
 */
export async function runWorkflowByWebhookToken(
  deps: WorkflowEngineDeps,
  token: string,
  input: Record<string, unknown>,
): Promise<WebhookRunResult> {
  const { store } = deps;
  const workflow = await store.getWorkflowByWebhookToken(token);
  if (!workflow || workflow.trigger.type !== "webhook") return { ok: false, reason: "not_found" };
  if (workflow.status !== "active") return { ok: false, reason: "inactive" };
  if (!workflow.graph.entryNodeId || workflow.graph.nodes.length === 0) {
    return { ok: false, reason: "empty" };
  }
  const organization = await store.getOrganizationById(workflow.organizationId);
  const run = await runWorkflow(deps, {
    workflow,
    organizationName: organization?.name ?? "our company",
    actor: { organizationId: workflow.organizationId, userId: null },
    triggeredBy: "webhook",
    input,
  });
  return { ok: true, run };
}

/**
 * Approve or reject a run that's paused at a human-approval step. Approving
 * records the decision and resumes the run from the approval node's next step;
 * rejecting records it and fails the run. Requires the run to be `waiting`.
 */
export async function resolveWorkflowRun(
  deps: WorkflowEngineDeps,
  actor: WorkflowActor,
  runId: string,
  decision: "approve" | "reject",
  note?: string,
): Promise<WorkflowRun> {
  const { store } = deps;
  const run = await store.getWorkflowRun(actor.organizationId, runId);
  if (!run) throw new WorkflowError("This run could not be found.");
  if (run.status !== "waiting" || !run.cursorNodeId) {
    throw new WorkflowError("This run is not waiting for a decision.");
  }

  const trimmedNote = note?.trim();
  await store.createWorkflowRunStep({
    organizationId: actor.organizationId,
    runId: run.id,
    nodeId: run.cursorNodeId,
    nodeType: "approval",
    sequence: run.stepCount,
    status: decision === "approve" ? "succeeded" : "failed",
    input: null,
    output:
      decision === "approve" ? (trimmedNote ? `Approved: ${trimmedNote}` : "Approved") : null,
    error:
      decision === "reject" ? (trimmedNote ? `Rejected: ${trimmedNote}` : "Rejected by reviewer.") : null,
  });
  await store.createAuditEvent({
    organizationId: actor.organizationId,
    actorType: "user",
    actorId: actor.userId,
    action: decision === "approve" ? "workflow.run_approved" : "workflow.run_rejected",
    targetType: "workflow_run",
    targetId: run.id,
    metadata: { workflowId: run.workflowId },
  });

  if (decision === "reject") {
    const failed = await store.updateWorkflowRun(run.id, {
      status: "failed",
      error: "A reviewer rejected this run at an approval step.",
      cursorNodeId: null,
      stepCount: run.stepCount + 1,
      finishedAt: new Date().toISOString(),
    });
    return failed ?? run;
  }
  return resumeRun(deps, run);
}

/**
 * Run every active schedule-triggered workflow whose next run is due, then
 * advance each one's next-run time. Called by the tick route (an external cron
 * hits it). Returns how many runs were started.
 */
export async function runDueScheduledWorkflows(
  deps: WorkflowEngineDeps,
  nowMs: number,
): Promise<{ started: number }> {
  const { store } = deps;
  const due = await store.listDueScheduledWorkflows(new Date(nowMs).toISOString());
  let started = 0;
  for (const workflow of due) {
    if (workflow.trigger.type !== "schedule") continue;
    if (!workflow.graph.entryNodeId || workflow.graph.nodes.length === 0) continue;
    const organization = await store.getOrganizationById(workflow.organizationId);
    try {
      await runWorkflow(deps, {
        workflow,
        organizationName: organization?.name ?? "our company",
        actor: { organizationId: workflow.organizationId, userId: null },
        triggeredBy: "schedule",
      });
      started += 1;
    } catch {
      // A single workflow's failure must not stop the rest of the tick.
    }
    const everyMinutes = Math.max(SCHEDULE_MIN_MINUTES, workflow.trigger.everyMinutes);
    await store.updateWorkflow(workflow.organizationId, workflow.id, {
      trigger: {
        type: "schedule",
        everyMinutes,
        nextRunAt: new Date(nowMs + everyMinutes * 60_000).toISOString(),
      },
    });
  }
  return { started };
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
