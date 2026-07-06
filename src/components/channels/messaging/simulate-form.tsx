"use client";

/**
 * Simulate incoming message panel (Prompt 009).
 *
 * Runs a fake inbound message through the full messaging runtime (always in
 * simulated mode — no real provider send). Clearly labeled as a test.
 */

import { useFormState, useFormStatus } from "react-dom";
import {
  simulateInboundAction,
  type MessagingActionState,
} from "@/modules/channels/messaging/actions";
import { buttonClasses, Card, Field, FieldError, Input, Notice, Textarea } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("secondary")}>
      {pending ? "Simulating…" : "Simulate incoming message"}
    </button>
  );
}

export function SimulateForm({
  employeeId,
  channelId,
  senderPlaceholder,
}: {
  employeeId: string;
  channelId: string;
  senderPlaceholder: string;
}) {
  const [state, formAction] = useFormState(simulateInboundAction, {} as MessagingActionState);

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-taurus-text">Test in simulated mode</h3>
      <p className="mt-1 text-xs text-taurus-faint">
        Send a pretend inbound message. It runs through the same runtime and generates a reply, but
        nothing is sent to a real provider.
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="channelId" value={channelId} />
        <Field label="From" htmlFor="from">
          <Input id="from" name="from" placeholder={senderPlaceholder} maxLength={200} />
        </Field>
        <Field label="Message" htmlFor="text">
          <Textarea id="text" name="text" rows={2} maxLength={2000} />
        </Field>
        {state?.error ? <FieldError>{state.error}</FieldError> : null}
        {state?.ok && state.note ? <Notice>{state.note}</Notice> : null}
        <SubmitButton />
      </form>
    </Card>
  );
}
