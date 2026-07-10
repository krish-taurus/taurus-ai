"use client";

/**
 * Approve / reject controls for a run paused at a human-approval step
 * (Sprint 050). Approving resumes the run; rejecting fails it.
 */

import { useFormState, useFormStatus } from "react-dom";
import { resolveWorkflowRunAction, type WorkflowActionState } from "@/modules/workflows/actions";
import { buttonClasses, FieldError, Textarea } from "@/components/ui";

function Decide({ decision, label, variant }: { decision: "approve" | "reject"; label: string; variant: "primary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name="decision" value={decision} disabled={pending} className={buttonClasses(variant, "sm")}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export function ApprovalControls({
  workflowId,
  runId,
  instructions,
}: {
  workflowId: string;
  runId: string;
  instructions: string;
}) {
  const [state, action] = useFormState(resolveWorkflowRunAction, {} as WorkflowActionState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="workflowId" value={workflowId} />
      <input type="hidden" name="runId" value={runId} />
      <p className="text-sm text-taurus-text">{instructions || "Approve to continue this run."}</p>
      <Textarea name="note" rows={2} placeholder="Add a note (optional)" />
      <div className="flex items-center gap-2">
        <Decide decision="approve" label="Approve & continue" variant="primary" />
        <Decide decision="reject" label="Reject" variant="danger" />
      </div>
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
