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
import { getMessagingProvider } from "@/modules/channels/messaging/registry";
import { resolveProviderConfig } from "@/modules/channels/messaging/config";
import { indexKnowledgeSource } from "@/modules/knowledge/indexing";
import { resolveEmbedder } from "@/modules/knowledge/embedder-resolver";
import {
  emptyContext,
  evaluateCondition,
  interpolate,
  triggerFieldsFrom,
  type RunContext,
} from "@/modules/workflows/templating";

/** Hard cap so a mis-wired graph (e.g. a cycle) can never run forever. */
export const MAX_STEPS_PER_RUN = 50;
/** How deep workflow-runs-workflow chains may nest before we refuse. */
export const MAX_WORKFLOW_DEPTH = 3;

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
  /** Nesting depth for workflow-runs-workflow chains (0 = top level). */
  depth?: number;
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

  if (node.type === "send_message") {
    const recipient = interpolate(node.recipientTemplate, context).trim();
    const text = interpolate(node.messageTemplate, context);
    const summary = `→ ${recipient || "(no recipient)"}: ${text}`;
    if (!recipient) {
      return { status: "failed", output: "", error: "This step has no recipient to send to.", nextNodeId: null, meaningful: false, employeeId: null, input: text || null };
    }
    const channel = await store.getEmployeeChannel(orgId, node.channelId);
    if (!channel) {
      return { status: "failed", output: "", error: "The channel for this step could not be found.", nextNodeId: null, meaningful: false, employeeId: null, input: summary };
    }
    const provider = getMessagingProvider(channel.channelProvider);
    if (!provider) {
      return { status: "failed", output: "", error: "This channel type can't send messages.", nextNodeId: null, meaningful: false, employeeId: null, input: summary };
    }
    try {
      const config = await resolveProviderConfig(store, channel, provider);
      const mode = provider.getProviderStatus(config).mode;
      let result: { status: string; errorCode: string | null };
      if (mode === "live") {
        result = await provider.sendMessage(
          {
            providerType: channel.channelProvider,
            channelType: channel.channelType,
            recipientExternalId: recipient,
            messageText: text,
            conversationId: `workflow-${params.workflow.id}`,
            channelId: channel.id,
            metadata: {},
          },
          config,
        );
      } else {
        result = { status: "simulated", errorCode: null };
      }
      if (result.status === "failed") {
        return { status: "failed", output: "", error: `The message could not be sent (${result.errorCode ?? "error"}).`, nextNodeId: null, meaningful: false, employeeId: null, input: summary };
      }
      return {
        status: "succeeded",
        output: `${result.status === "simulated" ? "Simulated send" : "Sent"} to ${recipient}`,
        error: null,
        nextNodeId: node.next,
        meaningful: false,
        employeeId: null,
        input: summary,
      };
    } catch {
      return { status: "failed", output: "", error: "The message could not be sent.", nextNodeId: null, meaningful: false, employeeId: null, input: summary };
    }
  }

  if (node.type === "sub_workflow") {
    const subInput = interpolate(node.inputTemplate, context) || context.triggerInput;
    if ((params.depth ?? 0) + 1 >= MAX_WORKFLOW_DEPTH) {
      return { status: "failed", output: "", error: `Workflows are nested too deep (limit ${MAX_WORKFLOW_DEPTH}).`, nextNodeId: null, meaningful: false, employeeId: null, input: subInput || null };
    }
    const sub = await store.getWorkflow(orgId, node.workflowId);
    if (!sub) {
      return { status: "failed", output: "", error: "The workflow this step runs could not be found.", nextNodeId: null, meaningful: false, employeeId: null, input: subInput || null };
    }
    if (!sub.graph.entryNodeId || sub.graph.nodes.length === 0) {
      return { status: "failed", output: "", error: `“${sub.name}” has no steps to run.`, nextNodeId: null, meaningful: false, employeeId: null, input: subInput || null };
    }
    const childRun = await runWorkflow(deps, {
      workflow: sub,
      organizationName: params.organizationName,
      actor: params.actor,
      triggeredBy: "workflow",
      input: { message: subInput },
      depth: (params.depth ?? 0) + 1,
    });
    if (childRun.status !== "succeeded") {
      return { status: "failed", output: childRun.output ?? "", error: `“${sub.name}” did not finish: ${childRun.error ?? "failed"}`, nextNodeId: null, meaningful: true, employeeId: null, input: subInput || null };
    }
    return {
      status: "succeeded",
      output: childRun.output ?? "",
      error: null,
      nextNodeId: node.next,
      meaningful: true,
      employeeId: null,
      input: subInput || null,
    };
  }

  if (node.type === "approval") {
    // Approval pauses the run and is handled by the drive loop, not here.
    return { status: "skipped", output: "", error: null, nextNodeId: node.next, meaningful: false, employeeId: null, input: null };
  }

  if (node.type === "refresh_knowledge") {
    // Re-chunk + re-embed the target's knowledge so the AI Employee retrieves the
    // latest content — the "retrain on the newest data" step. Runs through the
    // same indexing pipeline (and embedder) as manual "Prepare knowledge".
    const ctx = { organizationId: orgId, userId: params.actor.userId, role: "owner" as const };
    try {
      const embedder = await resolveEmbedder(store, orgId);
      let sourceIds: string[] = [];
      let label = "";
      if (node.target === "source") {
        if (!node.sourceId) {
          return { status: "failed", output: "", error: "This step has no knowledge source selected.", nextNodeId: null, meaningful: false, employeeId: null, input: null };
        }
        sourceIds = [node.sourceId];
        label = "1 source";
      } else {
        if (!node.employeeId) {
          return { status: "failed", output: "", error: "This step has no AI Employee selected.", nextNodeId: null, meaningful: false, employeeId: null, input: null };
        }
        const sources = await store.listKnowledgeSourcesForEmployee(orgId, node.employeeId);
        sourceIds = sources.filter((s) => s.status !== "archived").map((s) => s.id);
        label = `${sourceIds.length} source${sourceIds.length === 1 ? "" : "s"}`;
      }

      let ready = 0;
      let chunks = 0;
      for (const sourceId of sourceIds) {
        const result = await indexKnowledgeSource(store, embedder, ctx, sourceId);
        if (result.ready) ready += 1;
        chunks += result.chunkCount;
      }
      return {
        status: "succeeded",
        output: `Refreshed ${ready}/${sourceIds.length} sources (${chunks} chunks) with ${embedder.modelId}`,
        error: null,
        nextNodeId: node.next,
        meaningful: false,
        employeeId: node.target === "employee" ? node.employeeId ?? null : null,
        input: `Refresh knowledge · ${label}`,
      };
    } catch (err) {
      return {
        status: "failed",
        output: "",
        error: err instanceof Error ? err.message : "Could not refresh knowledge.",
        nextNodeId: null,
        meaningful: false,
        employeeId: null,
        input: null,
      };
    }
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
  const context = emptyContext(triggerInput, triggerFieldsFrom(params.input));

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

  if (!graph.entryNodeId || !graph.nodes.some((n) => n.id === graph.entryNodeId)) {
    return finalizeRun(deps, params, run, {
      status: "failed",
      error: "This workflow has no steps to run yet. Add a step and try again.",
      output: null,
      executed: 0,
    });
  }

  return driveRun(deps, params, run, graph.entryNodeId, context, 0, null);
}

/** Node types whose output is a meaningful run result (not pure routing/effect). */
const MEANINGFUL_TYPES = new Set(["employee", "transform", "sub_workflow"]);

/**
 * Execute a run from `startNodeId`, persisting a step per node, until the graph
 * ends, a step fails, an approval pauses it, or the step cap trips. Shared by a
 * fresh run and a resumed one, so pause/resume reuses the exact same loop.
 */
async function driveRun(
  deps: WorkflowEngineDeps,
  params: RunWorkflowParams,
  run: WorkflowRun,
  startNodeId: string | null,
  context: RunContext,
  startExecuted: number,
  startFinalOutput: string | null,
): Promise<WorkflowRun> {
  const { store } = deps;
  const orgId = params.actor.organizationId;
  const nodesById = new Map(params.workflow.graph.nodes.map((n) => [n.id, n]));

  let currentId: string | null = startNodeId;
  let executed = startExecuted;
  let finalOutput = startFinalOutput;
  let failure: string | null = null;
  let waitingAt: string | null = null;

  while (currentId && executed < MAX_STEPS_PER_RUN && !failure) {
    const node = nodesById.get(currentId);
    if (!node) break; // a dangling next pointer simply ends the run

    if (node.type === "approval") {
      waitingAt = node.id; // pause here until a human approves/rejects
      break;
    }

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

  if (waitingAt) {
    const waiting =
      (await store.updateWorkflowRun(run.id, {
        status: "waiting",
        cursorNodeId: waitingAt,
        stepCount: executed,
      })) ?? run;
    await store.createAuditEvent({
      organizationId: orgId,
      actorType: "system",
      actorId: params.actor.userId,
      action: "workflow.run_waiting",
      targetType: "workflow_run",
      targetId: run.id,
      metadata: { workflowId: params.workflow.id, approvalNodeId: waitingAt },
    });
    return waiting;
  }

  if (!failure && currentId && executed >= MAX_STEPS_PER_RUN) {
    failure = `This workflow stopped after ${MAX_STEPS_PER_RUN} steps — check for a loop.`;
  }

  return finalizeRun(deps, params, run, {
    status: failure ? "failed" : "succeeded",
    error: failure,
    output: finalOutput,
    executed,
  });
}

/** Write the terminal run state + audit and return the finished run. */
async function finalizeRun(
  deps: WorkflowEngineDeps,
  params: RunWorkflowParams,
  run: WorkflowRun,
  result: { status: "succeeded" | "failed"; error: string | null; output: string | null; executed: number },
): Promise<WorkflowRun> {
  const { store } = deps;
  const finished =
    (await store.updateWorkflowRun(run.id, {
      status: result.status,
      output: result.output,
      error: result.error,
      cursorNodeId: null,
      stepCount: result.executed,
      finishedAt: new Date().toISOString(),
    })) ?? run;
  await store.createAuditEvent({
    organizationId: params.actor.organizationId,
    actorType: "system",
    actorId: params.actor.userId,
    action: "workflow.run_finished",
    targetType: "workflow_run",
    targetId: run.id,
    metadata: { workflowId: params.workflow.id, status: finished.status, steps: result.executed },
  });
  return finished;
}

/** Rebuild the run context from the persisted step ledger (for resume). */
function rebuildContext(run: WorkflowRun, steps: { nodeId: string; output: string | null }[]): RunContext {
  const triggerInput = typeof run.input?.message === "string" ? run.input.message : "";
  const context = emptyContext(triggerInput, triggerFieldsFrom(run.input));
  for (const step of steps) context.steps[step.nodeId] = { output: step.output ?? "" };
  return context;
}

/**
 * Resume a run that was paused at an approval step. The caller has already
 * recorded the approval step, so the context is rebuilt from the ledger and the
 * run continues from the approval node's `next`. Returns the run's new state
 * (finished, failed, or waiting again at a later approval).
 */
export async function resumeRun(
  deps: WorkflowEngineDeps,
  run: WorkflowRun,
): Promise<WorkflowRun> {
  const { store } = deps;
  const workflow = await store.getWorkflow(run.organizationId, run.workflowId);
  if (!workflow) {
    return (
      (await store.updateWorkflowRun(run.id, {
        status: "failed",
        error: "This workflow no longer exists.",
        cursorNodeId: null,
        finishedAt: new Date().toISOString(),
      })) ?? run
    );
  }

  const steps = await store.listWorkflowRunSteps(run.organizationId, run.id);
  const context = rebuildContext(run, steps);
  const finalOutput =
    [...steps].reverse().find((s) => MEANINGFUL_TYPES.has(s.nodeType) && s.status === "succeeded")?.output ??
    run.output ??
    null;

  const approvalNode = run.cursorNodeId
    ? workflow.graph.nodes.find((n) => n.id === run.cursorNodeId)
    : undefined;
  const startNodeId =
    approvalNode && approvalNode.type === "approval" ? approvalNode.next : null;

  const organization = await store.getOrganizationById(run.organizationId);
  const params: RunWorkflowParams = {
    workflow,
    organizationName: organization?.name ?? "our company",
    actor: { organizationId: run.organizationId, userId: run.createdByUserId },
    triggeredBy: run.triggeredBy,
    input: run.input,
  };

  await store.updateWorkflowRun(run.id, { status: "running", cursorNodeId: null });
  const running = { ...run, status: "running" as const, cursorNodeId: null };
  return driveRun(deps, params, running, startNodeId, context, steps.length, finalOutput);
}
