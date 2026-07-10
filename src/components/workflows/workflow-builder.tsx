"use client";

/**
 * Workflow builder (Sprint 048).
 *
 * A form-based, list-style editor: steps run top to bottom, each feeding the
 * next. An AI Employee step sends a message and captures the reply; a Branch
 * step routes to a chosen step based on a comparison; a Format step reshapes
 * text with no model call. Steps reference earlier output with {{input}} and
 * {{steps.<id>.output}}. The whole graph is submitted as JSON on save.
 */

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveWorkflowAction, type WorkflowActionState } from "@/modules/workflows/actions";
import type {
  WorkflowConditionOperator,
  WorkflowGraph,
  WorkflowNode,
} from "@/lib/db/types";
import {
  buttonClasses,
  Badge,
  Card,
  Field,
  FieldError,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";

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

type StepType = "employee" | "condition" | "transform" | "send_message" | "sub_workflow";

interface EmployeeStep {
  id: string;
  type: "employee";
  employeeId: string;
  messageTemplate: string;
}
interface TransformStep {
  id: string;
  type: "transform";
  template: string;
}
interface ConditionStep {
  id: string;
  type: "condition";
  left: string;
  operator: WorkflowConditionOperator;
  right: string;
  caseSensitive: boolean;
  trueTarget: string; // step id or "__end__"
  falseTarget: string; // step id or "__end__"
}
interface SendMessageStep {
  id: string;
  type: "send_message";
  channelId: string;
  recipientTemplate: string;
  messageTemplate: string;
}
interface SubWorkflowStep {
  id: string;
  type: "sub_workflow";
  workflowId: string;
  inputTemplate: string;
}
type BuilderStep =
  | EmployeeStep
  | TransformStep
  | ConditionStep
  | SendMessageStep
  | SubWorkflowStep;

const END = "__end__";

const OPERATORS: { value: WorkflowConditionOperator; label: string }[] = [
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "equals", label: "equals" },
  { value: "not_equals", label: "does not equal" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? `s-${crypto.randomUUID().slice(0, 8)}`
    : `s-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** Load a stored graph into builder steps (array order = visual order). */
function graphToSteps(graph: WorkflowGraph): BuilderStep[] {
  return graph.nodes.map((node): BuilderStep => {
    if (node.type === "employee") {
      return { id: node.id, type: "employee", employeeId: node.employeeId, messageTemplate: node.messageTemplate };
    }
    if (node.type === "condition") {
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
    }
    if (node.type === "transform") {
      return { id: node.id, type: "transform", template: node.template };
    }
    if (node.type === "send_message") {
      return {
        id: node.id,
        type: "send_message",
        channelId: node.channelId,
        recipientTemplate: node.recipientTemplate,
        messageTemplate: node.messageTemplate,
      };
    }
    if (node.type === "sub_workflow") {
      return { id: node.id, type: "sub_workflow", workflowId: node.workflowId, inputTemplate: node.inputTemplate };
    }
    // trigger nodes aren't authored in the builder (manual trigger is implicit)
    return { id: node.id, type: "transform", template: "" };
  });
}

/** Build the persisted graph from builder steps (linear next by default). */
function stepsToGraph(steps: BuilderStep[]): WorkflowGraph {
  const nodes: WorkflowNode[] = steps.map((step, i) => {
    const next = steps[i + 1]?.id ?? null;
    if (step.type === "employee") {
      return { id: step.id, type: "employee", employeeId: step.employeeId, messageTemplate: step.messageTemplate, next };
    }
    if (step.type === "transform") {
      return { id: step.id, type: "transform", template: step.template, next };
    }
    if (step.type === "send_message") {
      return {
        id: step.id,
        type: "send_message",
        channelId: step.channelId,
        recipientTemplate: step.recipientTemplate,
        messageTemplate: step.messageTemplate,
        next,
      };
    }
    if (step.type === "sub_workflow") {
      return { id: step.id, type: "sub_workflow", workflowId: step.workflowId, inputTemplate: step.inputTemplate, next };
    }
    const resolve = (t: string) => (t === END ? null : t);
    return {
      id: step.id,
      type: "condition",
      expression: {
        left: step.left,
        operator: step.operator,
        right: step.right || undefined,
        caseSensitive: step.caseSensitive,
      },
      nextIfTrue: resolve(step.trueTarget),
      nextIfFalse: resolve(step.falseTarget),
    };
  });
  return { entryNodeId: steps[0]?.id ?? null, nodes };
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "md")}>
      {pending ? "Saving…" : "Save workflow"}
    </button>
  );
}

export function WorkflowBuilder({
  workflowId,
  initialGraph,
  employees,
  channels,
  workflows,
}: {
  workflowId: string;
  initialGraph: WorkflowGraph;
  employees: EmployeeOption[];
  channels: ChannelOption[];
  workflows: WorkflowOption[];
}) {
  const [steps, setSteps] = useState<BuilderStep[]>(() => graphToSteps(initialGraph));
  const [state, action] = useFormState(saveWorkflowAction, {} as WorkflowActionState);

  const graphJson = useMemo(() => JSON.stringify(stepsToGraph(steps)), [steps]);
  const stepLabels = useMemo(
    () =>
      steps.map((s, i) => ({
        id: s.id,
        label: `${i + 1}. ${labelFor(s, employees)}`,
      })),
    [steps, employees],
  );

  const update = (id: string, patch: Partial<BuilderStep>) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? ({ ...s, ...patch } as BuilderStep) : s)));
  const remove = (id: string) => setSteps((prev) => prev.filter((s) => s.id !== id));
  const move = (id: string, dir: -1 | 1) =>
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[to]] = [copy[to], copy[idx]];
      return copy;
    });
  const add = (type: StepType) =>
    setSteps((prev) => [...prev, blankStep(type, employees, channels, workflows)]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workflowId" value={workflowId} />
      <input type="hidden" name="graph" value={graphJson} />

      {/* Trigger (fixed — manual for now) */}
      <Card className="border-dashed p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-taurus-faint">Trigger</div>
            <div className="text-sm font-medium text-taurus-text">Run manually</div>
          </div>
          <Badge tone="outline">Start</Badge>
        </div>
        <p className="mt-2 text-xs text-taurus-faint">
          Starts when you click Run. Scheduled and channel triggers are coming next.
        </p>
      </Card>

      {steps.length === 0 ? (
        <Card className="p-6 text-center text-sm text-taurus-faint">
          No steps yet. Add the first step below to build your workflow.
        </Card>
      ) : (
        steps.map((step, i) => (
          <StepCard
            key={step.id}
            index={i}
            step={step}
            employees={employees}
            channels={channels}
            workflows={workflows}
            stepLabels={stepLabels}
            isFirst={i === 0}
            isLast={i === steps.length - 1}
            onChange={(patch) => update(step.id, patch)}
            onRemove={() => remove(step.id)}
            onMove={(dir) => move(step.id, dir)}
          />
        ))
      )}

      <Card className="flex flex-wrap items-center gap-2 p-3">
        <span className="mr-1 text-xs font-medium text-taurus-faint">Add step:</span>
        <button type="button" className={buttonClasses("secondary", "sm")} onClick={() => add("employee")}>
          + AI Employee
        </button>
        <button type="button" className={buttonClasses("secondary", "sm")} onClick={() => add("condition")}>
          + Branch
        </button>
        <button type="button" className={buttonClasses("secondary", "sm")} onClick={() => add("send_message")}>
          + Send message
        </button>
        <button type="button" className={buttonClasses("secondary", "sm")} onClick={() => add("sub_workflow")}>
          + Run workflow
        </button>
        <button type="button" className={buttonClasses("secondary", "sm")} onClick={() => add("transform")}>
          + Format
        </button>
      </Card>

      <div className="flex items-center gap-3">
        <SaveButton />
        {state?.ok ? <span className="text-sm text-taurus-primary">Saved.</span> : null}
        {state?.error ? <FieldError>{state.error}</FieldError> : null}
      </div>
    </form>
  );
}

function labelFor(step: BuilderStep, employees: EmployeeOption[]): string {
  if (step.type === "employee") {
    return employees.find((e) => e.id === step.employeeId)?.name ?? "AI Employee";
  }
  if (step.type === "condition") return "Branch";
  if (step.type === "send_message") return "Send message";
  if (step.type === "sub_workflow") return "Run workflow";
  return "Format";
}

function blankStep(
  type: StepType,
  employees: EmployeeOption[],
  channels: ChannelOption[],
  workflows: WorkflowOption[],
): BuilderStep {
  if (type === "employee") {
    return { id: newId(), type: "employee", employeeId: employees[0]?.id ?? "", messageTemplate: "{{input}}" };
  }
  if (type === "transform") {
    return { id: newId(), type: "transform", template: "{{input}}" };
  }
  if (type === "send_message") {
    return {
      id: newId(),
      type: "send_message",
      channelId: channels[0]?.id ?? "",
      recipientTemplate: "",
      messageTemplate: "{{input}}",
    };
  }
  if (type === "sub_workflow") {
    return { id: newId(), type: "sub_workflow", workflowId: workflows[0]?.id ?? "", inputTemplate: "{{input}}" };
  }
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

const TYPE_NAMES: Record<StepType, string> = {
  employee: "AI Employee",
  condition: "Branch",
  send_message: "Send message",
  sub_workflow: "Run workflow",
  transform: "Format",
};

function StepCard({
  index,
  step,
  employees,
  channels,
  workflows,
  stepLabels,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMove,
}: {
  index: number;
  step: BuilderStep;
  employees: EmployeeOption[];
  channels: ChannelOption[];
  workflows: WorkflowOption[];
  stepLabels: { id: string; label: string }[];
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<BuilderStep>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const typeName = TYPE_NAMES[step.type];
  const targets = [{ id: END, label: "Stop here" }, ...stepLabels.filter((s) => s.id !== step.id)];

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-taurus-muted text-xs font-semibold text-taurus-sub">
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-taurus-text">{typeName}</span>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label="Move up" disabled={isFirst} onClick={() => onMove(-1)}>↑</IconBtn>
          <IconBtn label="Move down" disabled={isLast} onClick={() => onMove(1)}>↓</IconBtn>
          <IconBtn label="Remove step" onClick={onRemove}>✕</IconBtn>
        </div>
      </div>

      {step.type === "employee" ? (
        <div className="flex flex-col gap-3">
          <Field label="Which AI Employee" htmlFor={`emp-${step.id}`}>
            {employees.length === 0 ? (
              <p className="text-sm text-taurus-faint">
                No AI Employees yet — create one first, then add it here.
              </p>
            ) : (
              <Select
                id={`emp-${step.id}`}
                value={step.employeeId}
                onChange={(e) => onChange({ employeeId: e.target.value })}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                    {emp.roleTitle ? ` — ${emp.roleTitle}` : ""}
                    {emp.ready ? "" : " (needs published DNA)"}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Message to send"
            htmlFor={`msg-${step.id}`}
            hint="Use {{input}} for the starting message or {{steps.<id>.output}} for an earlier step."
          >
            <Textarea
              id={`msg-${step.id}`}
              value={step.messageTemplate}
              onChange={(e) => onChange({ messageTemplate: e.target.value })}
              rows={3}
            />
          </Field>
        </div>
      ) : null}

      {step.type === "transform" ? (
        <Field
          label="Format template"
          htmlFor={`tpl-${step.id}`}
          hint="Combine earlier output, e.g. “Summary: {{steps.triage.output}}”."
        >
          <Textarea
            id={`tpl-${step.id}`}
            value={step.template}
            onChange={(e) => onChange({ template: e.target.value })}
            rows={3}
          />
        </Field>
      ) : null}

      {step.type === "send_message" ? (
        <div className="flex flex-col gap-3">
          <Field label="Send through" htmlFor={`ch-${step.id}`}>
            {channels.length === 0 ? (
              <p className="text-sm text-taurus-faint">
                No messaging channels connected yet. Set one up under Connections first.
              </p>
            ) : (
              <Select
                id={`ch-${step.id}`}
                value={step.channelId}
                onChange={(e) => onChange({ channelId: e.target.value })}
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Recipient"
            htmlFor={`rc-${step.id}`}
            hint="Phone, email or chat id — match the channel. Templates like {{input}} work too."
          >
            <Input
              id={`rc-${step.id}`}
              value={step.recipientTemplate}
              onChange={(e) => onChange({ recipientTemplate: e.target.value })}
              placeholder="e.g. +15551234567"
            />
          </Field>
          <Field label="Message" htmlFor={`sm-${step.id}`}>
            <Textarea
              id={`sm-${step.id}`}
              value={step.messageTemplate}
              onChange={(e) => onChange({ messageTemplate: e.target.value })}
              rows={3}
            />
          </Field>
        </div>
      ) : null}

      {step.type === "sub_workflow" ? (
        <div className="flex flex-col gap-3">
          <Field label="Which workflow to run" htmlFor={`wf-${step.id}`}>
            {workflows.length === 0 ? (
              <p className="text-sm text-taurus-faint">
                No other workflows yet — create another workflow to chain into it.
              </p>
            ) : (
              <Select
                id={`wf-${step.id}`}
                value={step.workflowId}
                onChange={(e) => onChange({ workflowId: e.target.value })}
              >
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Send it this message"
            htmlFor={`si-${step.id}`}
            hint="Becomes {{input}} inside the other workflow."
          >
            <Textarea
              id={`si-${step.id}`}
              value={step.inputTemplate}
              onChange={(e) => onChange({ inputTemplate: e.target.value })}
              rows={2}
            />
          </Field>
        </div>
      ) : null}

      {step.type === "condition" ? (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Compare this" htmlFor={`cl-${step.id}`}>
              <Input
                id={`cl-${step.id}`}
                value={step.left}
                onChange={(e) => onChange({ left: e.target.value })}
                placeholder="{{input}}"
              />
            </Field>
            <Field label="Condition" htmlFor={`co-${step.id}`}>
              <Select
                id={`co-${step.id}`}
                value={step.operator}
                onChange={(e) => onChange({ operator: e.target.value as WorkflowConditionOperator })}
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {step.operator !== "is_empty" && step.operator !== "is_not_empty" ? (
            <Field label="Value" htmlFor={`cr-${step.id}`}>
              <Input
                id={`cr-${step.id}`}
                value={step.right}
                onChange={(e) => onChange({ right: e.target.value })}
                placeholder="e.g. refund"
              />
            </Field>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="If true, go to" htmlFor={`ct-${step.id}`}>
              <Select
                id={`ct-${step.id}`}
                value={step.trueTarget}
                onChange={(e) => onChange({ trueTarget: e.target.value })}
              >
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Otherwise, go to" htmlFor={`cf-${step.id}`}>
              <Select
                id={`cf-${step.id}`}
                value={step.falseTarget}
                onChange={(e) => onChange({ falseTarget: e.target.value })}
              >
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function IconBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md text-taurus-faint hover:bg-taurus-muted hover:text-taurus-text disabled:opacity-30"
    >
      {children}
    </button>
  );
}
