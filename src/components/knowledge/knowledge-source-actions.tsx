"use client";

/**
 * Edit + Archive controls for a knowledge source (Prompt 006). Archive asks for
 * confirmation. Both re-check permissions server-side.
 */

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import type { KnowledgeSource } from "@/lib/db/types";
import {
  archiveSourceAction,
  syncCloudStorageSourceAction,
  syncDatabaseSourceAction,
  syncGoogleDriveSourceAction,
  type KnowledgeActionState,
} from "@/modules/knowledge/actions";
import { buttonClasses, FieldError } from "@/components/ui";

function SyncButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("secondary")}>
      {pending ? "Syncing…" : "Sync now"}
    </button>
  );
}

export function KnowledgeSourceActions({ source }: { source: KnowledgeSource }) {
  const isArchived = source.status === "archived";
  const isSyncable =
    source.sourceType === "database" ||
    source.sourceType === "google_drive" ||
    source.sourceType === "cloud_storage";
  const [state, formAction] = useFormState(archiveSourceAction, {} as KnowledgeActionState);
  const syncActionFor =
    source.sourceType === "google_drive"
      ? syncGoogleDriveSourceAction
      : source.sourceType === "cloud_storage"
        ? syncCloudStorageSourceAction
        : syncDatabaseSourceAction;
  const [syncState, syncAction] = useFormState(syncActionFor, {} as KnowledgeActionState);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2.5">
        {isSyncable && !isArchived ? (
          <form action={syncAction}>
            <input type="hidden" name="sourceId" value={source.id} />
            <SyncButton />
          </form>
        ) : null}
        <Link
          href={`/dashboard/knowledge/${source.id}/edit`}
          className={buttonClasses("secondary")}
        >
          Edit
        </Link>
        {!isArchived ? (
          <form
            action={formAction}
            onSubmit={(e) => {
              if (!window.confirm(`Archive "${source.name}"? It will be removed from the vault.`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="sourceId" value={source.id} />
            <button type="submit" className={buttonClasses("danger")}>
              Archive
            </button>
          </form>
        ) : null}
      </div>
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
      {syncState?.error ? <FieldError>{syncState.error}</FieldError> : null}
    </div>
  );
}
