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
import { buttonClasses } from "@/components/ui";

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
  const [, formAction] = useFormState(prepareEmployeeKnowledgeAction, {} as ChatActionState);
  return (
    <form action={formAction}>
      <input type="hidden" name="employeeId" value={employeeId} />
      <Button hasPrepared={hasPrepared} />
    </form>
  );
}
