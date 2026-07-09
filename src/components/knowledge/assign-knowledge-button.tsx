"use client";

/**
 * Assign / Remove a whole vault to an AI Employee (Sprint 029). A small client
 * wrapper so a failed assign/remove surfaces an inline message instead of a
 * silent no-op. Keeps the assign panel a server component.
 */

import { useFormState } from "react-dom";
import {
  assignVaultAction,
  unassignVaultAction,
  type KnowledgeActionState,
} from "@/modules/knowledge/actions";
import { buttonClasses, FieldError } from "@/components/ui";

export function AssignVaultButton({
  employeeId,
  vaultId,
  assigned,
}: {
  employeeId: string;
  vaultId: string;
  assigned: boolean;
}) {
  const action = assigned ? unassignVaultAction : assignVaultAction;
  const [state, formAction] = useFormState(action, {} as KnowledgeActionState);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="vaultId" value={vaultId} />
      <button type="submit" className={buttonClasses(assigned ? "outline" : "secondary", "sm")}>
        {assigned ? "Remove" : "Assign"}
      </button>
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
