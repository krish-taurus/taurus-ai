"use client";

/**
 * Per-node configuration fields (Sprint 054), shared by the list builder (inline
 * in each card) and the canvas (in the side drawer). Given a step + an onChange,
 * it renders exactly the inputs that step type needs. Branch targets are only
 * shown when `conditionTargets` is provided (the list wires them via dropdowns;
 * the canvas wires them by connecting handles).
 */

import type { WorkflowConditionOperator } from "@/lib/db/types";
import { Field, Input, Select, Textarea } from "@/components/ui";
import {
  OPERATORS,
  syncableSources,
  type BuilderStep,
  type ChannelOption,
  type EmployeeOption,
  type SourceOption,
  type WorkflowOption,
} from "@/components/workflows/graph-model";

export function StepFields({
  step,
  employees,
  channels,
  workflows,
  sources,
  conditionTargets,
  onChange,
}: {
  step: BuilderStep;
  employees: EmployeeOption[];
  channels: ChannelOption[];
  workflows: WorkflowOption[];
  sources: SourceOption[];
  /** When set, Branch nodes show true/false target dropdowns (list builder). */
  conditionTargets?: { id: string; label: string }[];
  onChange: (patch: Partial<BuilderStep>) => void;
}) {
  const id = step.id;

  if (step.type === "employee") {
    return (
      <div className="flex flex-col gap-3">
        <Field label="Which AI Employee" htmlFor={`emp-${id}`}>
          {employees.length === 0 ? (
            <p className="text-sm text-taurus-faint">No AI Employees yet — create one first.</p>
          ) : (
            <Select id={`emp-${id}`} value={step.employeeId} onChange={(e) => onChange({ employeeId: e.target.value })}>
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
          htmlFor={`msg-${id}`}
          hint="Use {{input}} for the starting message or {{steps.<id>.output}} for an earlier step."
        >
          <Textarea id={`msg-${id}`} value={step.messageTemplate} onChange={(e) => onChange({ messageTemplate: e.target.value })} rows={3} />
        </Field>
      </div>
    );
  }

  if (step.type === "transform") {
    return (
      <Field label="Format template" htmlFor={`tpl-${id}`} hint="Combine earlier output, e.g. “Summary: {{steps.triage.output}}”.">
        <Textarea id={`tpl-${id}`} value={step.template} onChange={(e) => onChange({ template: e.target.value })} rows={3} />
      </Field>
    );
  }

  if (step.type === "send_message") {
    return (
      <div className="flex flex-col gap-3">
        <Field label="Send through" htmlFor={`ch-${id}`}>
          {channels.length === 0 ? (
            <p className="text-sm text-taurus-faint">No messaging channels connected yet.</p>
          ) : (
            <Select id={`ch-${id}`} value={step.channelId} onChange={(e) => onChange({ channelId: e.target.value })}>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Recipient" htmlFor={`rc-${id}`} hint="Phone, email or chat id. Templates like {{trigger.sender}} work too.">
          <Input id={`rc-${id}`} value={step.recipientTemplate} onChange={(e) => onChange({ recipientTemplate: e.target.value })} placeholder="e.g. +15551234567" />
        </Field>
        <Field label="Message" htmlFor={`sm-${id}`}>
          <Textarea id={`sm-${id}`} value={step.messageTemplate} onChange={(e) => onChange({ messageTemplate: e.target.value })} rows={3} />
        </Field>
      </div>
    );
  }

  if (step.type === "sub_workflow") {
    return (
      <div className="flex flex-col gap-3">
        <Field label="Which workflow to run" htmlFor={`wf-${id}`}>
          {workflows.length === 0 ? (
            <p className="text-sm text-taurus-faint">No other workflows yet.</p>
          ) : (
            <Select id={`wf-${id}`} value={step.workflowId} onChange={(e) => onChange({ workflowId: e.target.value })}>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Send it this message" htmlFor={`si-${id}`} hint="Becomes {{input}} inside the other workflow.">
          <Textarea id={`si-${id}`} value={step.inputTemplate} onChange={(e) => onChange({ inputTemplate: e.target.value })} rows={2} />
        </Field>
      </div>
    );
  }

  if (step.type === "approval") {
    return (
      <Field label="What to approve" htmlFor={`ap-${id}`} hint="The run pauses here until someone approves or rejects it on the run page.">
        <Textarea id={`ap-${id}`} value={step.instructions} onChange={(e) => onChange({ instructions: e.target.value })} rows={2} />
      </Field>
    );
  }

  if (step.type === "sync_source") {
    const syncable = syncableSources(sources);
    return (
      <Field label="Data source to sync" htmlFor={`ss-${id}`} hint="Re-fetches the latest content from the source's connector, then re-indexes it.">
        {syncable.length === 0 ? (
          <p className="text-sm text-taurus-faint">
            No database sources yet. Connect one in the Knowledge Vault first. (Drive / SharePoint / cloud storage sync is coming next.)
          </p>
        ) : (
          <Select id={`ss-${id}`} value={step.sourceId} onChange={(e) => onChange({ sourceId: e.target.value })}>
            {syncable.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        )}
      </Field>
    );
  }

  if (step.type === "refresh_knowledge") {
    return (
      <div className="flex flex-col gap-3">
        <Field label="Refresh" htmlFor={`rk-${id}`}>
          <Select id={`rk-${id}`} value={step.target} onChange={(e) => onChange({ target: e.target.value as "employee" | "source" })}>
            <option value="employee">All of an AI Employee&apos;s knowledge</option>
            <option value="source">A single knowledge source</option>
          </Select>
        </Field>
        {step.target === "employee" ? (
          <Field label="Which AI Employee" htmlFor={`rke-${id}`}>
            {employees.length === 0 ? (
              <p className="text-sm text-taurus-faint">No AI Employees yet.</p>
            ) : (
              <Select id={`rke-${id}`} value={step.employeeId} onChange={(e) => onChange({ employeeId: e.target.value })}>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <Field label="Which knowledge source" htmlFor={`rks-${id}`}>
            {sources.length === 0 ? (
              <p className="text-sm text-taurus-faint">No knowledge sources yet.</p>
            ) : (
              <Select id={`rks-${id}`} value={step.sourceId} onChange={(e) => onChange({ sourceId: e.target.value })}>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <p className="text-xs text-taurus-faint">Re-reads and re-embeds so the AI Employee retrieves the latest. Pair with a Schedule trigger.</p>
      </div>
    );
  }

  // condition
  const showTargets = conditionTargets != null;
  const targets = [{ id: "__end__", label: "Stop here" }, ...(conditionTargets ?? []).filter((t) => t.id !== id)];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Compare this" htmlFor={`cl-${id}`}>
          <Input id={`cl-${id}`} value={step.left} onChange={(e) => onChange({ left: e.target.value })} placeholder="{{input}}" />
        </Field>
        <Field label="Condition" htmlFor={`co-${id}`}>
          <Select id={`co-${id}`} value={step.operator} onChange={(e) => onChange({ operator: e.target.value as WorkflowConditionOperator })}>
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </Select>
        </Field>
      </div>
      {step.operator !== "is_empty" && step.operator !== "is_not_empty" ? (
        <Field label="Value" htmlFor={`cr-${id}`}>
          <Input id={`cr-${id}`} value={step.right} onChange={(e) => onChange({ right: e.target.value })} placeholder="e.g. refund" />
        </Field>
      ) : null}
      {showTargets ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="If true, go to" htmlFor={`ct-${id}`}>
            <Select id={`ct-${id}`} value={step.trueTarget} onChange={(e) => onChange({ trueTarget: e.target.value })}>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Otherwise, go to" htmlFor={`cf-${id}`}>
            <Select id={`cf-${id}`} value={step.falseTarget} onChange={(e) => onChange({ falseTarget: e.target.value })}>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </Select>
          </Field>
        </div>
      ) : (
        <p className="text-xs text-taurus-faint">
          Connect the <span className="font-medium text-taurus-sub">true</span> and{" "}
          <span className="font-medium text-taurus-sub">false</span> handles to the next steps.
        </p>
      )}
    </div>
  );
}
