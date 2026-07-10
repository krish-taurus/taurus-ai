"use client";

/**
 * Workflow trigger panel (Sprint 049): choose how a workflow starts. Manual runs
 * from the dashboard; a webhook gives a private URL an external system can POST
 * to. Only an active workflow's webhook fires.
 */

import { useFormState, useFormStatus } from "react-dom";
import { setWorkflowTriggerAction, type WorkflowActionState } from "@/modules/workflows/actions";
import { buttonClasses, FieldError, Input } from "@/components/ui";

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("secondary", "sm")}>
      {pending ? busy : label}
    </button>
  );
}

export function TriggerPanel({
  workflowId,
  triggerType,
  webhookUrl,
}: {
  workflowId: string;
  triggerType: "manual" | "webhook";
  webhookUrl: string | null;
}) {
  const [state, action] = useFormState(setWorkflowTriggerAction, {} as WorkflowActionState);
  const nextKind = triggerType === "webhook" ? "manual" : "webhook";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-taurus-text">
            {triggerType === "webhook" ? "Webhook URL" : "Manual"}
          </div>
          <p className="text-xs text-taurus-faint">
            {triggerType === "webhook"
              ? "Starts when another system POSTs to the URL below."
              : "Starts when you click Run now."}
          </p>
        </div>
        <form action={action} className="flex flex-col items-end gap-1">
          <input type="hidden" name="workflowId" value={workflowId} />
          <input type="hidden" name="kind" value={nextKind} />
          <Submit
            label={triggerType === "webhook" ? "Switch to manual" : "Enable webhook URL"}
            busy="Saving…"
          />
          {state?.error ? <FieldError>{state.error}</FieldError> : null}
        </form>
      </div>

      {triggerType === "webhook" && webhookUrl ? (
        <div className="flex flex-col gap-1">
          <Input readOnly value={webhookUrl} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
          <p className="text-xs text-taurus-faint">
            Keep this URL secret — anyone with it can start the workflow. It only fires while the
            workflow is active. POST a JSON body like <code>{`{"message":"…"}`}</code>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
