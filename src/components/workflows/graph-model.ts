/**
 * Shared workflow graph model (Sprint 054).
 *
 * Types + pure helpers used by BOTH workflow editors — the list builder and the
 * drag-and-drop canvas. Each editor authors the same `WorkflowGraph` the engine
 * runs, so a workflow can be edited either way. No React here.
 */

import type { WorkflowConditionOperator, WorkflowGraph, WorkflowNode } from "@/lib/db/types";

export interface EmployeeOption {
  id: string;
  name: string;
  roleTitle: string | null;
  ready: boolean;
}
export interface ChannelOption {
  id: string;
  label: string;
}
export interface WorkflowOption {
  id: string;
  name: string;
}
export interface SourceOption {
  id: string;
  name: string;
  /** Connector-backed types (e.g. "database") can be re-fetched by a Sync step. */
  sourceType: string;
}

export const END = "__end__";

export type StepType =
  | "employee"
  | "condition"
  | "transform"
  | "send_message"
  | "sub_workflow"
  | "approval"
  | "refresh_knowledge"
  | "sync_source";

export interface EmployeeStep {
  id: string;
  type: "employee";
  employeeId: string;
  messageTemplate: string;
}
export interface TransformStep {
  id: string;
  type: "transform";
  template: string;
}
export interface ConditionStep {
  id: string;
  type: "condition";
  left: string;
  operator: WorkflowConditionOperator;
  right: string;
  caseSensitive: boolean;
  trueTarget: string; // step id or END
  falseTarget: string; // step id or END
}
export interface SendMessageStep {
  id: string;
  type: "send_message";
  channelId: string;
  recipientTemplate: string;
  messageTemplate: string;
}
export interface SubWorkflowStep {
  id: string;
  type: "sub_workflow";
  workflowId: string;
  inputTemplate: string;
}
export interface ApprovalStep {
  id: string;
  type: "approval";
  instructions: string;
}
export interface RefreshKnowledgeStep {
  id: string;
  type: "refresh_knowledge";
  target: "employee" | "source";
  employeeId: string;
  sourceId: string;
}
export interface SyncSourceStep {
  id: string;
  type: "sync_source";
  sourceId: string;
}
export type BuilderStep =
  | EmployeeStep
  | TransformStep
  | ConditionStep
  | SendMessageStep
  | SubWorkflowStep
  | ApprovalStep
  | RefreshKnowledgeStep
  | SyncSourceStep;

export const OPERATORS: { value: WorkflowConditionOperator; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

export const TYPE_NAMES: Record<StepType, string> = {
  employee: "AI Employee",
  condition: "Branch",
  send_message: "Send message",
  sub_workflow: "Run workflow",
  approval: "Wait for approval",
  refresh_knowledge: "Refresh knowledge",
  sync_source: "Sync data source",
  transform: "Format",
};

export const STEP_PALETTE: { type: StepType; label: string }[] = [
  { type: "employee", label: "AI Employee" },
  { type: "condition", label: "Branch" },
  { type: "send_message", label: "Send message" },
  { type: "sub_workflow", label: "Run workflow" },
  { type: "approval", label: "Wait for approval" },
  { type: "sync_source", label: "Sync data source" },
  { type: "refresh_knowledge", label: "Refresh knowledge" },
  { type: "transform", label: "Format" },
];

export function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? `s-${crypto.randomUUID().slice(0, 8)}`
    : `s-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function labelFor(step: BuilderStep, employees: EmployeeOption[]): string {
  if (step.type === "employee") {
    return employees.find((e) => e.id === step.employeeId)?.name ?? "AI Employee";
  }
  return TYPE_NAMES[step.type];
}

/** Connector-backed source types that a Sync step can re-fetch. */
export function syncableSources(sources: SourceOption[]): SourceOption[] {
  return sources.filter((s) => s.sourceType === "database");
}

export function blankStep(
  type: StepType,
  employees: EmployeeOption[],
  channels: ChannelOption[],
  workflows: WorkflowOption[],
  sources: SourceOption[],
): BuilderStep {
  switch (type) {
    case "employee":
      return { id: newId(), type, employeeId: employees[0]?.id ?? "", messageTemplate: "{{input}}" };
    case "transform":
      return { id: newId(), type, template: "{{input}}" };
    case "send_message":
      return { id: newId(), type, channelId: channels[0]?.id ?? "", recipientTemplate: "", messageTemplate: "{{input}}" };
    case "sub_workflow":
      return { id: newId(), type, workflowId: workflows[0]?.id ?? "", inputTemplate: "{{input}}" };
    case "approval":
      return { id: newId(), type, instructions: "Review and approve to continue." };
    case "refresh_knowledge":
      return { id: newId(), type, target: "employee", employeeId: employees[0]?.id ?? "", sourceId: sources[0]?.id ?? "" };
    case "sync_source":
      return { id: newId(), type, sourceId: syncableSources(sources)[0]?.id ?? "" };
    case "condition":
    default:
      return {
        id: newId(),
        type: "condition",
        left: "{{input}}",
        operator: "contains",
        right: "",
        caseSensitive: false,
        trueTarget: END,
        falseTarget: END,
      };
  }
}

/** Load a stored graph's nodes into editable builder steps. */
export function graphToSteps(graph: WorkflowGraph): BuilderStep[] {
  return graph.nodes.map((node): BuilderStep => {
    switch (node.type) {
      case "employee":
        return { id: node.id, type: "employee", employeeId: node.employeeId, messageTemplate: node.messageTemplate };
      case "condition":
        return {
          id: node.id,
          type: "condition",
          left: node.expression.left,
          operator: node.expression.operator,
          right: node.expression.right ?? "",
          caseSensitive: node.expression.caseSensitive ?? false,
          trueTarget: node.nextIfTrue ?? END,
          falseTarget: node.nextIfFalse ?? END,
        };
      case "transform":
        return { id: node.id, type: "transform", template: node.template };
      case "send_message":
        return {
          id: node.id,
          type: "send_message",
          channelId: node.channelId,
          recipientTemplate: node.recipientTemplate,
          messageTemplate: node.messageTemplate,
        };
      case "sub_workflow":
        return { id: node.id, type: "sub_workflow", workflowId: node.workflowId, inputTemplate: node.inputTemplate };
      case "approval":
        return { id: node.id, type: "approval", instructions: node.instructions };
      case "refresh_knowledge":
        return {
          id: node.id,
          type: "refresh_knowledge",
          target: node.target,
          employeeId: node.employeeId ?? "",
          sourceId: node.sourceId ?? "",
        };
      case "sync_source":
        return { id: node.id, type: "sync_source", sourceId: node.sourceId };
      default:
        // trigger nodes aren't authored (manual trigger is implicit)
        return { id: node.id, type: "transform", template: "" };
    }
  });
}

export interface NextPointers {
  next: string | null;
  nextIfTrue?: string | null;
  nextIfFalse?: string | null;
}

/** Build a persisted WorkflowNode from a builder step + its resolved connections. */
export function stepToWorkflowNode(step: BuilderStep, ptr: NextPointers): WorkflowNode {
  switch (step.type) {
    case "employee":
      return { id: step.id, type: "employee", employeeId: step.employeeId, messageTemplate: step.messageTemplate, next: ptr.next };
    case "transform":
      return { id: step.id, type: "transform", template: step.template, next: ptr.next };
    case "send_message":
      return {
        id: step.id,
        type: "send_message",
        channelId: step.channelId,
        recipientTemplate: step.recipientTemplate,
        messageTemplate: step.messageTemplate,
        next: ptr.next,
      };
    case "sub_workflow":
      return { id: step.id, type: "sub_workflow", workflowId: step.workflowId, inputTemplate: step.inputTemplate, next: ptr.next };
    case "approval":
      return { id: step.id, type: "approval", instructions: step.instructions, next: ptr.next };
    case "refresh_knowledge":
      return {
        id: step.id,
        type: "refresh_knowledge",
        target: step.target,
        employeeId: step.target === "employee" ? step.employeeId : undefined,
        sourceId: step.target === "source" ? step.sourceId : undefined,
        next: ptr.next,
      };
    case "sync_source":
      return { id: step.id, type: "sync_source", sourceId: step.sourceId, next: ptr.next };
    case "condition":
    default:
      return {
        id: step.id,
        type: "condition",
        expression: {
          left: step.left,
          operator: step.operator,
          right: step.right || undefined,
          caseSensitive: step.caseSensitive,
        },
        nextIfTrue: ptr.nextIfTrue ?? null,
        nextIfFalse: ptr.nextIfFalse ?? null,
      };
  }
}

/** Build a graph from an ordered step list (linear flow — the list builder). */
export function stepsToGraph(steps: BuilderStep[]): WorkflowGraph {
  const resolve = (t: string) => (t === END ? null : t);
  const nodes = steps.map((step, i) => {
    const next = steps[i + 1]?.id ?? null;
    if (step.type === "condition") {
      return stepToWorkflowNode(step, {
        next: null,
        nextIfTrue: resolve(step.trueTarget),
        nextIfFalse: resolve(step.falseTarget),
      });
    }
    return stepToWorkflowNode(step, { next });
  });
  return { entryNodeId: steps[0]?.id ?? null, nodes };
}

/** True for the two source handles a Branch node exposes on the canvas. */
export const CONDITION_HANDLES = { TRUE: "true", FALSE: "false" } as const;
