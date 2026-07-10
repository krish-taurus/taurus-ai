import { describe, it, expect } from "vitest";
import { InMemoryStore } from "@/lib/db/in-memory-store";
import { createEmptyDnaV1, type EmployeeDnaV1 } from "@/modules/employee-dna/schema";
import type { ChatGateway } from "@/modules/employee-chat/service";
import type { GatewayRequest, GatewayResponse } from "@/modules/model-gateway/types";
import type { AiEmployee, WorkflowGraph } from "@/lib/db/types";
import { emptyContext, interpolate, evaluateCondition } from "@/modules/workflows/templating";
import { runWorkflow, MAX_STEPS_PER_RUN } from "@/modules/workflows/engine";
import {
  createWorkflow,
  updateWorkflowDetails,
  startWorkflowRun,
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
