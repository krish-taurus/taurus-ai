"use client";

/** "Add to Website" — creates the web channel for an employee (Prompt 008). */

import { useFormState, useFormStatus } from "react-dom";
import { createWebChannelAction, type ChannelActionState } from "@/modules/channels/actions";
import { buttonClasses, FieldError } from "@/components/ui";

function Button() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
      {pending ? "Creating…" : "Add to Website"}
    </button>
  );
}

export function CreateChannelButton({ employeeId }: { employeeId: string }) {
  const [state, formAction] = useFormState(createWebChannelAction, {} as ChannelActionState);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="name" value="Website" />
      <Button />
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
