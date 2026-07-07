"use client";

/**
 * Prepare / Refresh Knowledge button (Prompt 007).
 *
 * Rebuilds the internal searchable excerpts for the employee's assigned sources
 * so chat answers stay grounded. Business language only ("prepare knowledge").
 */

import { useFormState, useFormStatus } from "react-dom";
import {
  prepareEmployeeKnowledgeAction,
  type ChatActionState,
} from "@/modules/employee-chat/actions";
import { buttonClasses, FieldError, Notice } from "@/components/ui";

function Button({ hasPrepared }: { hasPrepared: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("secondary", "sm")}>
      {pending ? "Preparing…" : hasPrepared ? "Refresh knowledge" : "Prepare knowledge"}
    </button>
  );
}

export function PrepareKnowledgeButton({
  employeeId,
  hasPrepared,
}: {
  employeeId: string;
  hasPrepared: boolean;
}) {
  const [state, formAction] = useFormState(prepareEmployeeKnowledgeAction, {} as ChatActionState);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="employeeId" value={employeeId} />
      <Button hasPrepared={hasPrepared} />
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
      {state?.ok ? <Notice>Knowledge prepared.</Notice> : null}
    </form>
  );
}
