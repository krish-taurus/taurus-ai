"use client";

/**
 * Archive-DNA-version control (Batch 4). A tiny client wrapper so a failed
 * archive (permission or store error) surfaces an inline message instead of a
 * silent no-op. Kept separate so the version-history list stays a server
 * component.
 */

import { useFormState } from "react-dom";
import { archiveDnaVersionAction, type DnaActionState } from "@/modules/employee-dna/actions";
import { FieldError } from "@/components/ui";

export function ArchiveVersionButton({
  employeeId,
  versionId,
}: {
  employeeId: string;
  versionId: string;
}) {
  const [state, formAction] = useFormState(archiveDnaVersionAction, {} as DnaActionState);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="versionId" value={versionId} />
      <button
        type="submit"
        className="text-xs font-medium text-taurus-faint transition-colors hover:text-taurus-text"
      >
        Archive
      </button>
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
