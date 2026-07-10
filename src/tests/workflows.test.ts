import { describe, it, expect } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import type { ChatGateway } from "@/modules/employee-chat/service";
import type { GatewayRequest, GatewayResponse } from "@/modules/model-gateway/types";
import type { AiEmployee, WorkflowGraph } from "@/lib/db/types";
import { emptyContext, interpolate, evaluateCondition } from "@/modules/workflows/templating";
import { runWorkflow, MAX_STEPS_PER_RUN, MAX_WORKFLOW_DEPTH } from "@/modules/workflows/engine";
import {
  createWorkflow,
  updateWorkflowDetails,
  setWorkflowTrigger,
  setWorkflowStatus,
  startWorkflowRun,
  runWorkflowByWebhookToken,
  runDueScheduledWorkflows,
  resolveWorkflowRun,
  listWorkflowRunSteps,
  WorkflowError,
} from "@/modules/workflows/service";

// --- Fixtures ---------------------------------------------------------------

/** Echo gateway: replies with the last user message wrapped in <…>, so a test
 * can prove one step's output flowed into the next step's prompt. */
function echoGateway(): ChatGateway {
  return {
    async resolveModelForTask() {
      return {
        model: {
          providerSlug: "openai",
          modelId: "gpt-5.4",
          displayName: "GPT-5.4",
          modelFamily: "gpt-5",
          status: "available",
          modelTier: "balanced",
          recommendedFor: "",
          contextWindowTokens: 400_000,
          maxOutputTokens: 128_000,
          supportsText: true,
          supportsVision: false,
          supportsAudio: false,
          supportsTools: false,
          supportsJson: false,
          supportsStreaming: false,
          supportsReasoning: false,
          supportsCaching: false,
          inputUsdPerMillionTokens: 1,
          cachedInputUsdPerMillionTokens: null,
          outputUsdPerMillionTokens: 2,
          pricingNotes: null,
          pricingSourceUrl: null,
          priceCheckedAt: null,
        },
        providerSlug: "openai",
        routingMode: "auto_balanced",
        reason: "test",
      };
    },
    async generateText(request: GatewayRequest): Promise<GatewayResponse> {
      const lastUser = [...request.messages].reverse().find((m) => m.role === "user");
      return {
        text: `<${lastUser?.content ?? ""}>`,
        providerSlug: "openai",
        modelId: "gpt-5.4",
        inputTokens: 10,
        outputTokens: 5,
        estimatedCostUsd: 0.0001,
        latencyMs: 1,
        demo: false,
      };
    },
  };
}

async function seedEmployee(store: InMemoryStore, orgId: string, name: string): Promise<AiEmployee> {
  const employee = await store.createEmployee({
    organizationId: orgId,
    name,
    roleTitle: "Specialist",
    createdBy: null,
  });
  const dna: EmployeeDnaV1 = {
    ...createEmptyDnaV1(),
    identity: { mission: "Help.", roleSummary: name, primaryGoals: ["x"], successCriteria: [] },
  };
  await store.saveEmployeeDnaDraft({ organizationId: orgId, employeeId: employee.id, dna, userId: "user-1" });
  await store.publishEmployeeDna({ organizationId: orgId, employeeId: employee.id, userId: "user-1" });
  return employee;
}

const actor = { organizationId: "org-1", userId: "user-1" };
function deps(store: InMemoryStore) {
  return { store, gateway: echoGateway(), isProduction: () => false };
}

async function seedChannel(store: InMemoryStore, employeeId: string) {
  return store.createEmployeeChannel({
    organizationId: actor.organizationId,
    employeeId,
    channelType: "sms",
    channelProvider: "twilio",
    publicKey: `pk-${Math.random().toString(36).slice(2, 10)}`,
    name: "SMS line",
    appearance: {
      theme: "light",
      position: "bottom-right",
      launcherLabel: "Chat",
      employeeDisplayName: "Nova",
      accentStyle: "mono",
      showSources: false,
      collectVisitorEmail: false,
      brandName: null,
    },
  });
}

// --- Templating (pure) ------------------------------------------------------

describe("workflow templating", () => {
  it("resolves input, step outputs, and shorthand references", () => {
    const ctx = emptyContext("hello");
    ctx.steps["triage"] = { output: "refund please" };
    expect(interpolate("You said: {{input}}", ctx)).toBe("You said: hello");
    expect(interpolate("{{steps.triage.output}}", ctx)).toBe("refund please");
    expect(interpolate("{{triage}}", ctx)).toBe("refund please");
    expect(interpolate("missing: {{nope}}!", ctx)).toBe("missing: !");
  });

  it("resolves {{trigger.<field>}} from extra trigger payload fields", () => {
    const ctx = emptyContext("hello", { sender: "+15550001111", senderLabel: "Ann" });
    expect(interpolate("Reply to {{trigger.sender}} ({{trigger.senderLabel}})", ctx)).toBe(
      "Reply to +15550001111 (Ann)",
    );
    expect(interpolate("{{trigger.input}} = {{input}}", ctx)).toBe("hello = hello");
  });

  it("evaluates conditions with case-insensitive default", () => {
    const ctx = emptyContext("Refund PLEASE");
    expect(evaluateCondition({ left: "{{input}}", operator: "contains", right: "refund" }, ctx)).toBe(true);
    expect(
      evaluateCondition({ left: "{{input}}", operator: "contains", right: "refund", caseSensitive: true }, ctx),
    ).toBe(false);
    expect(evaluateCondition({ left: "{{input}}", operator: "is_not_empty" }, ctx)).toBe(true);
    expect(evaluateCondition({ left: "{{missing}}", operator: "is_empty" }, ctx)).toBe(true);
    expect(evaluateCondition({ left: "a", operator: "not_equals", right: "b" }, ctx)).toBe(true);
  });
});

// --- Engine -----------------------------------------------------------------

describe("workflow engine", () => {
  it("chains employees, passing one output into the next step's prompt", async () => {
    const store = new InMemoryStore();
    const a = await seedEmployee(store, actor.organizationId, "Triage");
    const b = await seedEmployee(store, actor.organizationId, "Refunds");
    const graph: WorkflowGraph = {
      entryNodeId: "n1",
      nodes: [
        { id: "n1", type: "employee", employeeId: a.id, messageTemplate: "{{input}}", next: "n2" },
        { id: "n2", type: "employee", employeeId: b.id, messageTemplate: "{{steps.n1.output}}", next: null },
      ],
    };
    const workflow = await store.createWorkflow({
      organizationId: actor.organizationId,
      name: "Handoff",
      graph,
    });

    const run = await runWorkflow(deps(store), {
      workflow,
      organizationName: "Acme",
      actor,
      triggeredBy: "manual",
      input: { message: "hi" },
    });

    expect(run.status).toBe("succeeded");
    expect(run.stepCount).toBe(2);
    // A echoed "hi" -> "<hi>"; B received "<hi>" and echoed "<<hi>>".
    expect(run.output).toBe("<<hi>>");
    const steps = await listWorkflowRunSteps(store, actor.organizationId, run.id);
    expect(steps.map((s) => s.status)).toEqual(["succeeded", "succeeded"]);
    expect(steps[0].output).toBe("<hi>");
    expect(steps[1].input).toBe("<hi>"); // the interpolated prompt B actually received
    expect(steps[1].employeeId).toBe(b.id);
  });

  it("branches on a condition and only runs the taken path", async () => {
    const store = new InMemoryStore();
    const refunds = await seedEmployee(store, actor.organizationId, "Refunds");
    const sales = await seedEmployee(store, actor.organizationId, "Sales");
    const graph: WorkflowGraph = {
      entryNodeId: "cond",
      nodes: [
        {
          id: "cond",
          type: "condition",
          expression: { left: "{{input}}", operator: "contains", right: "refund" },
          nextIfTrue: "refunds",
          nextIfFalse: "sales",
        },
        { id: "refunds", type: "employee", employeeId: refunds.id, messageTemplate: "{{input}}", next: null },
        { id: "sales", type: "employee", employeeId: sales.id, messageTemplate: "{{input}}", next: null },
      ],
    };
    const workflow = await store.createWorkflow({ organizationId: actor.organizationId, name: "Router", graph });

    const run = await runWorkflow(deps(store), {
      workflow,
      organizationName: "Acme",
      actor,
      triggeredBy: "manual",
      input: { message: "I need a refund" },
    });
    expect(run.status).toBe("succeeded");
    const steps = await listWorkflowRunSteps(store, actor.organizationId, run.id);
    expect(steps.map((s) => s.nodeId)).toEqual(["cond", "refunds"]); // sales never ran
    expect(steps[1].employeeId).toBe(refunds.id);
  });

  it("fails the run (not the request) when a step's employee has no published DNA", async () => {
    const store = new InMemoryStore();
    const bare = await store.createEmployee({
      organizationId: actor.organizationId,
      name: "Draft",
      roleTitle: "x",
      createdBy: null,
    });
    const graph: WorkflowGraph = {
      entryNodeId: "n1",
      nodes: [{ id: "n1", type: "employee", employeeId: bare.id, messageTemplate: "{{input}}", next: null }],
    };
    const workflow = await store.createWorkflow({ organizationId: actor.organizationId, name: "Bad", graph });

    const run = await runWorkflow(deps(store), {
      workflow,
      organizationName: "Acme",
      actor,
      triggeredBy: "manual",
      input: { message: "hi" },
    });
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/published DNA/i);
    const steps = await listWorkflowRunSteps(store, actor.organizationId, run.id);
    expect(steps[0].status).toBe("failed");
  });

  it("stops a self-looping graph at the step cap instead of running forever", async () => {
    const store = new InMemoryStore();
    const graph: WorkflowGraph = {
      entryNodeId: "loop",
      nodes: [{ id: "loop", type: "transform", template: "{{input}}", next: "loop" }],
    };
    const workflow = await store.createWorkflow({ organizationId: actor.organizationId, name: "Loop", graph });
    const run = await runWorkflow(deps(store), {
      workflow,
      organizationName: "Acme",
      actor,
      triggeredBy: "manual",
      input: { message: "x" },
    });
    expect(run.status).toBe("failed");
    expect(run.stepCount).toBe(MAX_STEPS_PER_RUN);
    expect(run.error).toMatch(/stopped after/i);
  });
});

// --- Phase 2: sub-workflow, send-message, webhook ---------------------------

describe("workflow engine — sub-workflows", () => {
  it("runs another workflow as a step and passes its output on", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, actor.organizationId, "Child");
    const child = await store.createWorkflow({
      organizationId: actor.organizationId,
      name: "Child flow",
      status: "active",
      graph: {
        entryNodeId: "c1",
        nodes: [{ id: "c1", type: "employee", employeeId: emp.id, messageTemplate: "{{input}}", next: null }],
      },
    });
    const parent = await store.createWorkflow({
      organizationId: actor.organizationId,
      name: "Parent flow",
      graph: {
        entryNodeId: "p1",
        nodes: [{ id: "p1", type: "sub_workflow", workflowId: child.id, inputTemplate: "{{input}}", next: null }],
      },
    });

    const run = await runWorkflow(deps(store), {
      workflow: parent,
      organizationName: "Acme",
      actor,
      triggeredBy: "manual",
      input: { message: "go" },
    });
    expect(run.status).toBe("succeeded");
    expect(run.output).toBe("<go>"); // child employee echoed the passed input
    // Both the parent run and the child run are recorded.
    expect(await store.listWorkflowRunsForWorkflow(actor.organizationId, child.id)).toHaveLength(1);
  });

  it("refuses to nest workflows past the depth cap", async () => {
    const store = new InMemoryStore();
    // A workflow that calls itself would recurse forever without the cap.
    const wf = await store.createWorkflow({
      organizationId: actor.organizationId,
      name: "Recursive",
      status: "active",
      graph: { entryNodeId: "x", nodes: [] },
    });
    // Point it at itself now that we have its id.
    await store.updateWorkflow(actor.organizationId, wf.id, {
      graph: {
        entryNodeId: "x",
        nodes: [{ id: "x", type: "sub_workflow", workflowId: wf.id, inputTemplate: "{{input}}", next: null }],
      },
    });
    const reloaded = await store.getWorkflow(actor.organizationId, wf.id);
    const run = await runWorkflow(deps(store), {
      workflow: reloaded!,
      organizationName: "Acme",
      actor,
      triggeredBy: "manual",
      input: { message: "loop" },
    });
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/nested too deep/i);
    expect(MAX_WORKFLOW_DEPTH).toBeGreaterThan(0);
  });
});

describe("workflow engine — send message", () => {
  it("records a simulated send when the channel has no live credentials", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, actor.organizationId, "Notifier");
    const channel = await seedChannel(store, emp.id);
    const wf = await store.createWorkflow({
      organizationId: actor.organizationId,
      name: "Notify",
      graph: {
        entryNodeId: "n1",
        nodes: [
          {
            id: "n1",
            type: "send_message",
            channelId: channel.id,
            recipientTemplate: "+15551230000",
            messageTemplate: "Hello {{input}}",
            next: null,
          },
        ],
      },
    });
    const run = await runWorkflow(deps(store), {
      workflow: wf,
      organizationName: "Acme",
      actor,
      triggeredBy: "manual",
      input: { message: "there" },
    });
    expect(run.status).toBe("succeeded");
    const steps = await listWorkflowRunSteps(store, actor.organizationId, run.id);
    expect(steps[0].nodeType).toBe("send_message");
    expect(steps[0].output).toMatch(/Simulated send to \+15551230000/);
  });

  it("fails the step when the send has no recipient", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, actor.organizationId, "Notifier");
    const channel = await seedChannel(store, emp.id);
    const wf = await store.createWorkflow({
      organizationId: actor.organizationId,
      name: "Notify",
      graph: {
        entryNodeId: "n1",
        nodes: [
          { id: "n1", type: "send_message", channelId: channel.id, recipientTemplate: "", messageTemplate: "hi", next: null },
        ],
      },
    });
    const run = await runWorkflow(deps(store), {
      workflow: wf,
      organizationName: "Acme",
      actor,
      triggeredBy: "manual",
      input: { message: "" },
    });
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/no recipient/i);
  });
});

describe("workflow webhook trigger", () => {
  it("runs an active workflow by its token and rejects inactive/unknown tokens", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, actor.organizationId, "Helper");
    const wf = await createWorkflow(store, actor, { name: "Hooked" });
    await updateWorkflowDetails(store, actor, wf.id, {
      graph: {
        entryNodeId: "n1",
        nodes: [{ id: "n1", type: "employee", employeeId: emp.id, messageTemplate: "{{input}}", next: null }],
      },
    });
    const withTrigger = await setWorkflowTrigger(store, actor, wf.id, { kind: "webhook" });
    const token = withTrigger.trigger.type === "webhook" ? withTrigger.trigger.token : "";
    expect(token.length).toBeGreaterThanOrEqual(16);

    // Not active yet → inactive.
    const inactive = await runWorkflowByWebhookToken(deps(store), token, { message: "hi" });
    expect(inactive).toEqual({ ok: false, reason: "inactive" });

    await setWorkflowStatus(store, actor, wf.id, "active");
    const ok = await runWorkflowByWebhookToken(deps(store), token, { message: "hi" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.run.output).toBe("<hi>");

    const unknown = await runWorkflowByWebhookToken(deps(store), "nope-token-value", { message: "x" });
    expect(unknown).toEqual({ ok: false, reason: "not_found" });
  });
});

// --- Phase 2b: approval pause/resume, schedule ------------------------------

function approvalGraph(): WorkflowGraph {
  return {
    entryNodeId: "n1",
    nodes: [
      { id: "n1", type: "transform", template: "Ticket: {{input}}", next: "gate" },
      { id: "gate", type: "approval", instructions: "Approve this refund?", next: "n3" },
      { id: "n3", type: "transform", template: "Escalated → {{steps.n1.output}}", next: null },
    ],
  };
}

describe("workflow approvals (pause/resume)", () => {
  it("pauses at an approval step, then resumes to completion when approved", async () => {
    const store = new InMemoryStore();
    const wf = await store.createWorkflow({ organizationId: actor.organizationId, name: "Approval", graph: approvalGraph() });
    const run = await runWorkflow(deps(store), {
      workflow: wf,
      organizationName: "Acme",
      actor,
      triggeredBy: "manual",
      input: { message: "order 1234" },
    });
    // Paused: only the first step ran, run is waiting at the approval node.
    expect(run.status).toBe("waiting");
    expect(run.cursorNodeId).toBe("gate");
    expect(run.stepCount).toBe(1);
    let steps = await listWorkflowRunSteps(store, actor.organizationId, run.id);
    expect(steps.map((s) => s.nodeId)).toEqual(["n1"]);

    // Approve → resumes from the approval node's next, runs to completion.
    const resumed = await resolveWorkflowRun(deps(store), actor, run.id, "approve", "looks good");
    expect(resumed.status).toBe("succeeded");
    expect(resumed.output).toBe("Escalated → Ticket: order 1234");
    steps = await listWorkflowRunSteps(store, actor.organizationId, run.id);
    expect(steps.map((s) => `${s.nodeId}:${s.status}`)).toEqual([
      "n1:succeeded",
      "gate:succeeded",
      "n3:succeeded",
    ]);
    expect(steps[1].output).toMatch(/Approved: looks good/);
  });

  it("fails the run when the approval is rejected and runs no further steps", async () => {
    const store = new InMemoryStore();
    const wf = await store.createWorkflow({ organizationId: actor.organizationId, name: "Approval", graph: approvalGraph() });
    const run = await runWorkflow(deps(store), {
      workflow: wf,
      organizationName: "Acme",
      actor,
      triggeredBy: "manual",
      input: { message: "x" },
    });
    expect(run.status).toBe("waiting");
    const rejected = await resolveWorkflowRun(deps(store), actor, run.id, "reject", "not allowed");
    expect(rejected.status).toBe("failed");
    const steps = await listWorkflowRunSteps(store, actor.organizationId, run.id);
    expect(steps.map((s) => s.nodeId)).toEqual(["n1", "gate"]); // n3 never ran
    expect(steps[1].status).toBe("failed");

    // Resolving again is refused (no longer waiting).
    await expect(resolveWorkflowRun(deps(store), actor, run.id, "approve")).rejects.toThrow(/not waiting/i);
  });
});

describe("workflow channel trigger", () => {
  it("binds to a channel and a send-message step can reply to the inbound sender", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, actor.organizationId, "Support");
    const channel = await seedChannel(store, emp.id);
    const wf = await store.createWorkflow({
      organizationId: actor.organizationId,
      name: "Auto-reply",
      status: "active",
      trigger: { type: "channel", channelId: channel.id },
      graph: {
        entryNodeId: "n1",
        nodes: [
          {
            id: "n1",
            type: "send_message",
            channelId: channel.id,
            recipientTemplate: "{{trigger.sender}}",
            messageTemplate: "Thanks, we got: {{input}}",
            next: null,
          },
        ],
      },
    });

    // The messaging runtime finds the bound workflow by channel.
    const found = await store.getActiveChannelWorkflow(actor.organizationId, channel.id);
    expect(found?.id).toBe(wf.id);

    // Running it with inbound sender context replies to that sender.
    const run = await runWorkflow(deps(store), {
      workflow: wf,
      organizationName: "Acme",
      actor,
      triggeredBy: "channel",
      input: { message: "hi there", sender: "+15550009999", channelId: channel.id },
    });
    expect(run.status).toBe("succeeded");
    const steps = await listWorkflowRunSteps(store, actor.organizationId, run.id);
    expect(steps[0].output).toMatch(/Simulated send to \+15550009999/);
  });
});

describe("workflow refresh-knowledge node", () => {
  it("re-indexes an employee's assigned sources so retrieval reflects the latest content", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, actor.organizationId, "Support");
    // Assign a knowledge source to the employee (via its vault).
    const vault = await store.createKnowledgeVault({ organizationId: actor.organizationId, name: "Docs" });
    const source = await store.createKnowledgeSource({
      organizationId: actor.organizationId,
      vaultId: vault.id,
      name: "Refund policy",
      sourceType: "text",
      status: "ready",
    });
    await store.createKnowledgeDocument({
      organizationId: actor.organizationId,
      knowledgeSourceId: source.id,
      title: "Policy",
      textContent: "Customers can request a refund within 30 days of purchase.",
      extractionStatus: "not_required",
    });
    await store.assignVaultToEmployee({
      organizationId: actor.organizationId,
      employeeId: emp.id,
      vaultId: vault.id,
    });

    // Before: no retrieval segments indexed yet.
    expect(
      await store.listKnowledgeRetrievalSegmentsForSource(actor.organizationId, source.id),
    ).toHaveLength(0);

    const wf = await store.createWorkflow({
      organizationId: actor.organizationId,
      name: "Nightly retrain",
      graph: {
        entryNodeId: "n1",
        nodes: [{ id: "n1", type: "refresh_knowledge", target: "employee", employeeId: emp.id, next: null }],
      },
    });
    const run = await runWorkflow(deps(store), {
      workflow: wf,
      organizationName: "Acme",
      actor,
      triggeredBy: "schedule",
      input: {},
    });

    expect(run.status).toBe("succeeded");
    const steps = await listWorkflowRunSteps(store, actor.organizationId, run.id);
    expect(steps[0].nodeType).toBe("refresh_knowledge");
    expect(steps[0].output).toMatch(/Refreshed 1\/1 sources/);
    // After: the source is chunked + embedded, so the employee can retrieve it.
    const segments = await store.listKnowledgeRetrievalSegmentsForSource(actor.organizationId, source.id);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0].embedding).not.toBeNull();
  });

  it("fails cleanly when no target is selected", async () => {
    const store = new InMemoryStore();
    const wf = await store.createWorkflow({
      organizationId: actor.organizationId,
      name: "Bad refresh",
      graph: {
        entryNodeId: "n1",
        nodes: [{ id: "n1", type: "refresh_knowledge", target: "source", next: null }],
      },
    });
    const run = await runWorkflow(deps(store), {
      workflow: wf,
      organizationName: "Acme",
      actor,
      triggeredBy: "manual",
      input: {},
    });
    expect(run.status).toBe("failed");
    expect(run.error).toMatch(/no knowledge source selected/i);
  });
});

describe("workflow schedule tick", () => {
  it("runs a due active scheduled workflow and advances its next run time", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, actor.organizationId, "Digest");
    const wf = await store.createWorkflow({
      organizationId: actor.organizationId,
      name: "Nightly",
      status: "active",
      trigger: { type: "schedule", everyMinutes: 60, nextRunAt: "2020-01-01T00:00:00.000Z" },
      graph: { entryNodeId: "n1", nodes: [{ id: "n1", type: "employee", employeeId: emp.id, messageTemplate: "summarize", next: null }] },
    });
    const now = Date.parse("2026-07-10T09:00:00.000Z");
    const result = await runDueScheduledWorkflows(deps(store), now);
    expect(result.started).toBe(1);
    const runs = await store.listWorkflowRunsForWorkflow(actor.organizationId, wf.id);
    expect(runs).toHaveLength(1);
    expect(runs[0].triggeredBy).toBe("schedule");
    // nextRunAt advanced ~60 min into the future.
    const after = await store.getWorkflow(actor.organizationId, wf.id);
    const next = after?.trigger.type === "schedule" ? Date.parse(after.trigger.nextRunAt) : 0;
    expect(next).toBe(now + 60 * 60_000);
  });

  it("does not run a paused scheduled workflow", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, actor.organizationId, "Digest");
    await store.createWorkflow({
      organizationId: actor.organizationId,
      name: "Paused",
      status: "paused",
      trigger: { type: "schedule", everyMinutes: 60, nextRunAt: "2020-01-01T00:00:00.000Z" },
      graph: { entryNodeId: "n1", nodes: [{ id: "n1", type: "employee", employeeId: emp.id, messageTemplate: "x", next: null }] },
    });
    const result = await runDueScheduledWorkflows(deps(store), Date.parse("2026-07-10T09:00:00.000Z"));
    expect(result.started).toBe(0);
  });
});

// --- Service ----------------------------------------------------------------

describe("workflows service", () => {
  it("creates a draft and rejects a blank name", async () => {
    const store = new InMemoryStore();
    const wf = await createWorkflow(store, actor, { name: "  My flow  " });
    expect(wf.status).toBe("draft");
    expect(wf.name).toBe("My flow");
    await expect(createWorkflow(store, actor, { name: "   " })).rejects.toBeInstanceOf(WorkflowError);
  });

  it("rejects a graph whose connection points at a missing step", async () => {
    const store = new InMemoryStore();
    const wf = await createWorkflow(store, actor, { name: "Flow" });
    await expect(
      updateWorkflowDetails(store, actor, wf.id, {
        graph: {
          entryNodeId: "n1",
          nodes: [{ id: "n1", type: "transform", template: "x", next: "ghost" }],
        },
      }),
    ).rejects.toThrow(/no longer exists/i);
  });

  it("refuses to run an empty workflow with a clear message", async () => {
    const store = new InMemoryStore();
    const wf = await createWorkflow(store, actor, { name: "Empty" });
    await expect(
      startWorkflowRun(deps(store), actor, wf.id, {}),
    ).rejects.toThrow(/at least one step/i);
  });

  it("runs a saved workflow through the service entry point", async () => {
    const store = new InMemoryStore();
    const emp = await seedEmployee(store, actor.organizationId, "Helper");
    const wf = await createWorkflow(store, actor, { name: "Flow" });
    const saved = await updateWorkflowDetails(store, actor, wf.id, {
      graph: {
        entryNodeId: "n1",
        nodes: [{ id: "n1", type: "employee", employeeId: emp.id, messageTemplate: "{{input}}", next: null }],
      },
    });
    expect(saved.graph.nodes).toHaveLength(1);
    const run = await startWorkflowRun(deps(store), actor, wf.id, { input: { message: "ping" } });
    expect(run.status).toBe("succeeded");
    expect(run.output).toBe("<ping>");
  });
});
