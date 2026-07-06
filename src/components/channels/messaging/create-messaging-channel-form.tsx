"use client";

/** Create a messaging channel (Prompt 009). */

import { useFormState, useFormStatus } from "react-dom";
import {
  createMessagingChannelAction,
  type MessagingActionState,
} from "@/modules/channels/messaging/actions";
import { buttonClasses, Field, FieldError, Input, Select } from "@/components/ui";
import type { ChannelProviderType, ChannelType } from "@/lib/db/types";
import { MESSAGING_PROVIDER_LABELS, SENDER_ID_LABELS } from "@/modules/channels/messaging/catalog";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
      {pending ? "Creating…" : "Create channel"}
    </button>
  );
}

export function CreateMessagingChannelForm({
  employeeId,
  channelType,
  employeeName,
  providers,
}: {
  employeeId: string;
  channelType: ChannelType;
  employeeName: string;
  providers: ChannelProviderType[];
}) {
  const [state, formAction] = useFormState(
    createMessagingChannelAction,
    {} as MessagingActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="channelType" value={channelType} />

      <Field label="Provider" htmlFor="provider" hint="You can change this later.">
        <Select id="provider" name="provider" defaultValue={providers[0]}>
          {providers.map((p) => (
            <option key={p} value={p}>
              {MESSAGING_PROVIDER_LABELS[p] ?? p}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Channel name" htmlFor="name">
        <Input
          id="name"
          name="name"
          defaultValue={`${employeeName} — ${channelType}`}
          maxLength={80}
        />
      </Field>

      <Field
        label={SENDER_ID_LABELS[channelType] ?? "Sender identifier"}
        htmlFor="senderId"
        optional
        hint="The number or address customers message. You can add it later."
      >
        <Input id="senderId" name="senderId" maxLength={200} />
      </Field>

      {state?.error ? <FieldError>{state.error}</FieldError> : null}
      <SubmitButton />
    </form>
  );
}
