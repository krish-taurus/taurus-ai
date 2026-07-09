"use client";

/**
 * Vault management controls (Sprint 028) — create / rename / delete a vault.
 * Vaults organize knowledge sources; the default "General" vault can't be removed.
 */

import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import {
  createKnowledgeVaultAction,
  renameKnowledgeVaultAction,
  deleteKnowledgeVaultAction,
  type KnowledgeActionState,
} from "@/modules/knowledge/actions";
import { buttonClasses, cn, FieldError, Input } from "@/components/ui";

function Submitting({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary")}>
      {pending ? busy : label}
    </button>
  );
}

/** "New vault" — reveals a small inline form. */
export function NewVaultButton() {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(createKnowledgeVaultAction, {} as KnowledgeActionState);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClasses("secondary")}>
        New vault
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input name="name" required minLength={2} placeholder="Vault name" className="sm:w-56" />
      <div className="flex items-center gap-2">
        <Submitting label="Create" busy="Creating…" />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-medium text-taurus-sub hover:text-taurus-text"
        >
          Cancel
        </button>
      </div>
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}

/** Per-vault header actions: add to vault, and (non-default) rename / delete. */
export function VaultActions({
  vaultId,
  vaultName,
  isDefault,
  canManage,
}: {
  vaultId: string;
  vaultName: string;
  isDefault: boolean;
  canManage: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [renameState, renameAction] = useFormState(
    renameKnowledgeVaultAction,
    {} as KnowledgeActionState,
  );
  const [deleteState, deleteAction] = useFormState(
    deleteKnowledgeVaultAction,
    {} as KnowledgeActionState,
  );

  if (!canManage) return null;

  if (renaming) {
    return (
      <form action={renameAction} className="flex items-center gap-2">
        <input type="hidden" name="vaultId" value={vaultId} />
        <Input name="name" required minLength={2} defaultValue={vaultName} className="w-48" />
        <Submitting label="Save" busy="Saving…" />
        <button
          type="button"
          onClick={() => setRenaming(false)}
          className="text-sm font-medium text-taurus-sub hover:text-taurus-text"
        >
          Cancel
        </button>
        {renameState?.error ? <FieldError>{renameState.error}</FieldError> : null}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link
        href={`/dashboard/knowledge/new?vault=${vaultId}`}
        className="font-medium text-taurus-sub hover:text-taurus-text"
      >
        Add
      </Link>
      {!isDefault ? (
        <>
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="font-medium text-taurus-sub hover:text-taurus-text"
          >
            Rename
          </button>
          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (
                !window.confirm(
                  `Delete the "${vaultName}" vault? Its sources move to the General vault.`,
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="vaultId" value={vaultId} />
            <button
              type="submit"
              className={cn("font-medium text-taurus-sub hover:text-taurus-text")}
            >
              Delete
            </button>
          </form>
          {deleteState?.error ? <FieldError>{deleteState.error}</FieldError> : null}
        </>
      ) : null}
    </div>
  );
}
