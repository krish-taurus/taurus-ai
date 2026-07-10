"use client";

/**
 * Microsoft Teams connect form (Sprint 043). Enters the Azure Bot / AAD app
 * credentials + tenant. The secret is write-only (stored encrypted server-side).
 */

import { useFormState, useFormStatus } from "react-dom";
import { connectTeamsAction, type TeamsActionState } from "@/modules/channels/teams/actions";
import { buttonClasses, Field, FieldError, Input } from "@/components/ui";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary")}>
      {pending ? "Connecting…" : "Connect Teams"}
    </button>
  );
}

export function TeamsConnectForm({
  employeeId,
  defaults,
}: {
  employeeId: string;
  defaults?: { appId?: string; tenantId?: string; tenantName?: string | null };
}) {
  const [state, action] = useFormState(connectTeamsAction, {} as TeamsActionState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      <Field label="Microsoft App ID" htmlFor="appId">
        <Input id="appId" name="appId" defaultValue={defaults?.appId ?? ""} required />
      </Field>
      <Field label="Client secret" htmlFor="appPassword" hint="Stored encrypted; shown only as you type.">
        <Input id="appPassword" name="appPassword" type="password" required />
      </Field>
      <Field label="Tenant ID" htmlFor="tenantId">
        <Input id="tenantId" name="tenantId" defaultValue={defaults?.tenantId ?? ""} required />
      </Field>
      <Field label="Workspace name (optional)" htmlFor="tenantName">
        <Input id="tenantName" name="tenantName" defaultValue={defaults?.tenantName ?? ""} />
      </Field>
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
      <div>
        <Save />
      </div>
    </form>
  );
}
