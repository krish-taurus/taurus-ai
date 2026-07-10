"use client";

/**
 * Create-workflow form (Sprint 048). Names a new draft, then the action
 * redirects into the builder for that workflow.
 */

import { useFormState, useFormStatus } from "react-dom";
import { createWorkflowAction, type WorkflowActionState } from "@/modules/workflows/actions";
import { buttonClasses, Field, FieldError, Input, Textarea } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "md")}>
      {pending ? "Creating…" : "Create workflow"}
    </button>
  );
}

export function CreateWorkflowForm() {
  const [state, action] = useFormState(createWorkflowAction, {} as WorkflowActionState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Workflow name" htmlFor="wf-name">
        <Input id="wf-name" name="name" placeholder="e.g. Support triage" required maxLength={120} />
      </Field>
      <Field label="Description" htmlFor="wf-desc" hint="Optional — what this workflow does.">
        <Textarea id="wf-desc" name="description" rows={2} maxLength={1000} />
      </Field>
      <div className="flex items-center gap-3">
        <Submit />
        {state?.error ? <FieldError>{state.error}</FieldError> : null}
      </div>
    </form>
  );
}
