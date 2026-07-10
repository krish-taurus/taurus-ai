"use client";

/**
 * Workflow run + lifecycle controls (Sprint 048): run now, activate/pause, and
 * delete. Each is a small server-action form that surfaces errors inline.
 */

import { useFormState, useFormStatus } from "react-dom";
import {
  runWorkflowAction,
  setWorkflowStatusAction,
  deleteWorkflowAction,
  type WorkflowActionState,
} from "@/modules/workflows/actions";
import type { WorkflowStatus } from "@/lib/db/types";
import { buttonClasses, Field, FieldError, Textarea } from "@/components/ui";

function Submit({
  label,
  busy,
  variant = "primary",
  size = "md",
  confirm,
}: {
  label: string;
  busy: string;
  variant?: "primary" | "secondary" | "outline" | "danger";
  size?: "sm" | "md";
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClasses(variant, size)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? busy : label}
    </button>
  );
}

/** Run the workflow now with an optional starting message. */
export function RunWorkflowForm({ workflowId }: { workflowId: string }) {
  const [state, action] = useFormState(runWorkflowAction, {} as WorkflowActionState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workflowId" value={workflowId} />
      <Field
        label="Starting message"
        htmlFor="run-message"
        hint="Sent to the first step as {{input}}. Optional."
      >
        <Textarea id="run-message" name="message" rows={3} placeholder="e.g. I want a refund for order 1234" />
      </Field>
      <div className="flex items-center gap-3">
        <Submit label="Run now" busy="Running…" />
        {state?.error ? <FieldError>{state.error}</FieldError> : null}
      </div>
    </form>
  );
}

/** Toggle a workflow between active and paused. */
export function WorkflowStatusButton({
  workflowId,
  status,
}: {
  workflowId: string;
  status: WorkflowStatus;
}) {
  const [state, action] = useFormState(setWorkflowStatusAction, {} as WorkflowActionState);
  const next: WorkflowStatus = status === "active" ? "paused" : "active";
  const label = status === "active" ? "Pause" : "Activate";
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="workflowId" value={workflowId} />
      <input type="hidden" name="status" value={next} />
      <Submit label={label} busy="Saving…" variant="secondary" size="sm" />
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}

/** Permanently delete a workflow (with confirmation). */
export function DeleteWorkflowButton({ workflowId }: { workflowId: string }) {
  const [state, action] = useFormState(deleteWorkflowAction, {} as WorkflowActionState);
  return (
    <form action={action} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="workflowId" value={workflowId} />
      <Submit
        label="Delete"
        busy="Deleting…"
        variant="danger"
        size="sm"
        confirm="Delete this workflow and its run history? This can't be undone."
      />
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
