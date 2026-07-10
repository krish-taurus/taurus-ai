/**
 * Workflow execution engine (Sprint 048) — server only.
 *
 * Runs a workflow as a durable, checkpointed state machine: start at the entry
 * node, execute one node at a time, persist a step row for each, and follow the
 * node's `next` pointer until the graph ends. Each employee node runs headlessly
 * through the SAME `sendChatMessage` path as chat (a system actor), so every
 * governance gate, model-routing rule and billing quota still applies — a
 * workflow can never spend or answer in a way normal chat couldn't.
 *
 * Phase 1 drives this inline within the triggering request; the run/step ledger
 * it writes is already shaped for a later "advance a running run via a tick"
 * resume, so no rewrite is needed to make long/waiting runs durable.
 */

import type { DataStore } from "@/lib/db/store";
import type {
  AiEmployee,
  Workflow,
  WorkflowNode,
  WorkflowRun,
  WorkflowRunStepStatus,
  WorkflowRunTriggerSource,
} from "@/lib/db/types";
import {
  sendChatMessage,
  ChatBlockedError,
  type ChatGateway,
} from "@/modules/employee-chat/service";
import { EntitlementError } from "@/modules/billing/service";
import { emptyContext, evaluateCondition, interpolate, type RunContext } from "@/modules/workflows/templating";

/** Hard cap so a mis-wired graph (e.g. a cycle) can never run forever. */
export const MAX_STEPS_PER_RUN = 50;

export interface WorkflowEngineDeps {
  store: DataStore;
  gateway: ChatGateway;
  isProduction?: () => boolean;
}

export interface RunWorkflowParams {
  workflow: Workflow;
  organizationName: string;
  actor: { organizationId: string; userId: string | null };
  triggeredBy: WorkflowRunTriggerSource;
  /** Trigger payload; `message` is used as the run's starting text. */
  input?: Record<string, unknown>;
}

interface StepOutcome {
  status: WorkflowRunStepStatus;
  output: string;
  error: string | null;
  nextNodeId: string | null;
  /** True for nodes whose output is a meaningful result (not pure routing). */
  meaningful: boolean;
  employeeId: string | null;
  input: string | null;
}

function friendlyBlockedReason(err: ChatBlockedError): string {
  switch (err.reason) {
    case "needs_dna":
      return "This AI Employee has no published DNA yet, so it can't run.";
    case "archived":
      return "This AI Employee has been archived.";
    case "no_model":
      return "This AI Employee has no model configured.";
    case "needs_model_hub":
      return "No live model provider is configured. Add a key in Model Hub to run this step.";
    default:
      return "This AI Employee is not available to run.";
  }
}

/** Execute a single node and report its outcome (never throws). */
async function executeNode(
  deps: WorkflowEngineDeps,
  params: RunWorkflowParams,
  node: WorkflowNode,
  context: RunContext,
): Promise<StepOutcome> {
  const { store, gateway } = deps;
  const orgId = params.actor.organizationId;

  if (node.type === "trigger") {
    return {
      status: "succeeded",
      output: context.triggerInput,
      error: null,
      nextNodeId: node.next,
      meaningful: false,
      employeeId: null,
      input: context.triggerInput || null,
    };
  }

  if (node.type === "transform") {
    const output = interpolate(node.template, context);
    return {
      status: "succeeded",
      output,
      error: null,
      nextNodeId: node.next,
      meaningful: true,
      employeeId: null,
      input: node.template,
    };
  }

  if (node.type === "condition") {
    const passed = evaluateCondition(node.expression, context);
    return {
      status: "succeeded",
      output: passed ? "true" : "false",
      error: null,
      nextNodeId: passed ? node.nextIfTrue : node.nextIfFalse,
      meaningful: false,
      employeeId: null,
      input: `${node.expression.left} ${node.expression.operator} ${node.expression.right ?? ""}`.trim(),
    };
  }

  // employee node
  const message = interpolate(node.messageTemplate, context) || context.triggerInput;
  const employee: AiEmployee | null = await store.getEmployee(orgId, node.employeeId);
  if (!employee || employee.status === "archived") {
    return {
      status: "failed",
      output: "",
      error: "This AI Employee could not be found or has been archived.",
      nextNodeId: null,
      meaningful: false,
      employeeId: node.employeeId,
      input: message || null,
    };
  }

  try {
    // A fresh thread per step keeps each run isolated from prior runs + chat.
    const thread = await store.createEmployeeChatThread({
      organizationId: orgId,
      employeeId: employee.id,
      title: `Workflow · ${params.workflow.name}`.slice(0, 80),
      createdByUserId: params.actor.userId,
    });
    const result = await sendChatMessage(
      { store, gateway, isProduction: deps.isProduction },
      {
        actor: { organizationId: orgId, userId: params.actor.userId, actorType: "system" },
        organizationName: params.organizationName,
        employee,
        threadId: thread.id,
        message,
        channelType: null,
      },
    );
    return {
      status: "succeeded",
      output: result.assistantMessage.content,
      error: null,
      nextNodeId: node.next,
      meaningful: true,
      employeeId: employee.id,
      input: message || null,
    };
  } catch (err) {
    const error =
      err instanceof ChatBlockedError
        ? friendlyBlockedReason(err)
        : err instanceof EntitlementError
          ? err.message
          : "This step could not be completed.";
    return {
      status: "failed",
      output: "",
      error,
      nextNodeId: null,
      meaningful: false,
      employeeId: employee.id,
      input: message || null,
    };
  }
}

/**
 * Run a workflow end to end, persisting a run + one step per executed node.
 * Returns the finished run. Never throws for author/graph errors — those become
 * a `failed` run with a readable error so the run history explains what happened.
 */
export async function runWorkflow(
  deps: WorkflowEngineDeps,
  params: RunWorkflowParams,
): Promise<WorkflowRun> {
  const { store } = deps;
  const orgId = params.actor.organizationId;
  const { graph } = params.workflow;

  const triggerInput =
    typeof params.input?.message === "string" ? params.input.message : "";
  const context = emptyContext(triggerInput);

  const run = await store.createWorkflowRun({
    organizationId: orgId,
    workflowId: params.workflow.id,
    triggeredBy: params.triggeredBy,
    input: params.input ?? {},
    status: "running",
    createdByUserId: params.actor.userId,
  });

  await store.createAuditEvent({
    organizationId: orgId,
    actorType: "system",
    actorId: params.actor.userId,
    action: "workflow.run_started",
    targetType: "workflow_run",
    targetId: run.id,
    metadata: { workflowId: params.workflow.id, triggeredBy: params.triggeredBy },
  });

  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  let currentId: string | null = graph.entryNodeId;
  let executed = 0;
  let finalOutput: string | null = null;
  let failure: string | null = null;

  if (!currentId || !nodesById.has(currentId)) {
    failure = "This workflow has no steps to run yet. Add a step and try again.";
  }

  while (currentId && executed < MAX_STEPS_PER_RUN && !failure) {
    const node = nodesById.get(currentId);
    if (!node) break; // a dangling next pointer simply ends the run

    const outcome = await executeNode(deps, params, node, context);
    await store.createWorkflowRunStep({
      organizationId: orgId,
      runId: run.id,
      nodeId: node.id,
      nodeType: node.type,
      employeeId: outcome.employeeId,
      sequence: executed,
      status: outcome.status,
      input: outcome.input,
      output: outcome.output || null,
      error: outcome.error,
    });
    executed += 1;

    context.steps[node.id] = { output: outcome.output };
    if (outcome.meaningful && outcome.status === "succeeded") finalOutput = outcome.output;

    if (outcome.status === "failed") {
      failure = outcome.error ?? "A step failed.";
      break;
    }

    currentId = outcome.nextNodeId;
  }

  if (!failure && currentId && executed >= MAX_STEPS_PER_RUN) {
    failure = `This workflow stopped after ${MAX_STEPS_PER_RUN} steps — check for a loop.`;
  }

  const finished =
    (await store.updateWorkflowRun(run.id, {
      status: failure ? "failed" : "succeeded",
      output: finalOutput,
      error: failure,
      stepCount: executed,
      finishedAt: new Date().toISOString(),
    })) ?? run;

  await store.createAuditEvent({
    organizationId: orgId,
    actorType: "system",
    actorId: params.actor.userId,
    action: "workflow.run_finished",
    targetType: "workflow_run",
    targetId: run.id,
    metadata: { workflowId: params.workflow.id, status: finished.status, steps: executed },
  });

  return finished;
}
