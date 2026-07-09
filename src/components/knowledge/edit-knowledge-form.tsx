"use client";

/**
 * Edit knowledge source metadata (Prompt 006). Name, description, visibility.
 */

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import type { KnowledgeSource } from "@/lib/db/types";
import { updateSourceAction, type KnowledgeActionState } from "@/modules/knowledge/actions";
import { buttonClasses, Field, FieldError, Input, Select } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export function EditKnowledgeForm({
  source,
  vaults = [],
}: {
  source: KnowledgeSource;
  vaults?: { id: string; name: string }[];
}) {
  const [state, formAction] = useFormState(updateSourceAction, {} as KnowledgeActionState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="sourceId" value={source.id} />

      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required minLength={2} defaultValue={source.name} />
      </Field>

      <Field label="Description" htmlFor="description" optional>
        <Input id="description" name="description" defaultValue={source.description ?? ""} />
      </Field>

      {vaults.length > 0 ? (
        <Field label="Vault" htmlFor="vaultId">
          <Select id="vaultId" name="vaultId" defaultValue={source.vaultId ?? vaults[0]?.id}>
            {vaults.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <Field label="Who can see this?" htmlFor="visibility">
        <Select id="visibility" name="visibility" defaultValue={source.visibility}>
          <option value="organization">Everyone in the organization</option>
          <option value="private">Private (admins only)</option>
        </Select>
      </Field>

      {state?.error ? <FieldError>{state.error}</FieldError> : null}

      <div className="flex items-center gap-4">
        <SubmitButton />
        <Link
          href={`/dashboard/knowledge/${source.id}`}
          className="text-sm font-medium text-taurus-sub transition-colors hover:text-taurus-text"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
