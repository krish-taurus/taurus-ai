"use client";

/**
 * Assign / Remove knowledge control (Batch 4). A small client wrapper so a
 * failed assign/remove (permission or store error) surfaces an inline message
 * instead of a silent no-op. Keeps the assign panel a server component.
 */

import { useFormState } from "react-dom";
import {
  assignKnowledgeAction,
  unassignKnowledgeAction,
  type KnowledgeActionState,
} from "@/modules/knowledge/actions";
import { buttonClasses, FieldError } from "@/components/ui";

export function AssignKnowledgeButton({
  employeeId,
  knowledgeSourceId,
  assigned,
}: {
  employeeId: string;
  knowledgeSourceId: string;
  assigned: boolean;
}) {
  const action = assigned ? unassignKnowledgeAction : assignKnowledgeAction;
  const [state, formAction] = useFormState(action, {} as KnowledgeActionState);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="knowledgeSourceId" value={knowledgeSourceId} />
      <button type="submit" className={buttonClasses(assigned ? "outline" : "secondary", "sm")}>
        {assigned ? "Remove" : "Assign"}
      </button>
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
