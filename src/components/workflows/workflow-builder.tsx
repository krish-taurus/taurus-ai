"use client";

/**
 * Workflow builder — list view (Sprint 048; shared model Sprint 054).
 *
 * A form-based, list-style editor: steps run top to bottom, each feeding the
 * next. The whole graph is submitted as JSON on save. The drag-and-drop canvas
 * (workflow-canvas.tsx) is an alternative editor over the same graph.
 */

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveWorkflowAction, type WorkflowActionState } from "@/modules/workflows/actions";
import type { WorkflowGraph } from "@/lib/db/types";
import { buttonClasses, Badge, Card, FieldError } from "@/components/ui";
import { StepFields } from "@/components/workflows/step-fields";
import {
  blankStep,
  graphToSteps,
  labelFor,
  stepsToGraph,
  STEP_PALETTE,
  TYPE_NAMES,
  type BuilderStep,
  type StepType,
} from "@/components/workflows/graph-model";

export type {
  EmployeeOption,
  ChannelOption,
  WorkflowOption,
  SourceOption,
} from "@/components/workflows/graph-model";
import type {
  EmployeeOption,
  ChannelOption,
  WorkflowOption,
  SourceOption,
} from "@/components/workflows/graph-model";

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
  sources,
}: {
  workflowId: string;
  initialGraph: WorkflowGraph;
  employees: EmployeeOption[];
  channels: ChannelOption[];
  workflows: WorkflowOption[];
  sources: SourceOption[];
}) {
  const [steps, setSteps] = useState<BuilderStep[]>(() => graphToSteps(initialGraph));
  const [state, action] = useFormState(saveWorkflowAction, {} as WorkflowActionState);

  const graphJson = useMemo(() => JSON.stringify(stepsToGraph(steps)), [steps]);
  const stepLabels = useMemo(
    () => steps.map((s, i) => ({ id: s.id, label: `${i + 1}. ${labelFor(s, employees)}` })),
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
    setSteps((prev) => [...prev, blankStep(type, employees, channels, workflows, sources)]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workflowId" value={workflowId} />
      <input type="hidden" name="graph" value={graphJson} />

      <Card className="border-dashed p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-taurus-faint">Trigger</div>
            <div className="text-sm font-medium text-taurus-text">Set on the right →</div>
          </div>
          <Badge tone="outline">Start</Badge>
        </div>
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
            sources={sources}
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
        {STEP_PALETTE.map((p) => (
          <button key={p.type} type="button" className={buttonClasses("secondary", "sm")} onClick={() => add(p.type)}>
            + {p.label}
          </button>
        ))}
      </Card>

      <div className="flex items-center gap-3">
        <SaveButton />
        {state?.ok ? <span className="text-sm text-taurus-primary">Saved.</span> : null}
        {state?.error ? <FieldError>{state.error}</FieldError> : null}
      </div>
    </form>
  );
}

function StepCard({
  index,
  step,
  employees,
  channels,
  workflows,
  sources,
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
  sources: SourceOption[];
  stepLabels: { id: string; label: string }[];
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<BuilderStep>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-taurus-muted text-xs font-semibold text-taurus-sub">
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-taurus-text">{TYPE_NAMES[step.type]}</span>
        </div>
        <div className="flex items-center gap-1">
          <IconBtn label="Move up" disabled={isFirst} onClick={() => onMove(-1)}>↑</IconBtn>
          <IconBtn label="Move down" disabled={isLast} onClick={() => onMove(1)}>↓</IconBtn>
          <IconBtn label="Remove step" onClick={onRemove}>✕</IconBtn>
        </div>
      </div>
      <StepFields
        step={step}
        employees={employees}
        channels={channels}
        workflows={workflows}
        sources={sources}
        conditionTargets={stepLabels}
        onChange={onChange}
      />
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
