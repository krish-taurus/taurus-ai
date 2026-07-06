"use client";

/** Edit a messaging channel's name + non-secret sender config (Prompt 009). */

import { useFormState, useFormStatus } from "react-dom";
import type { EmployeeChannel } from "@/lib/db/types";
import {
  updateMessagingChannelAction,
  type MessagingActionState,
} from "@/modules/channels/messaging/actions";
import { SENDER_ID_LABELS } from "@/modules/channels/messaging/catalog";
import { buttonClasses, Field, FieldError, Input, Notice } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary")}>
      {pending ? "Saving…" : "Save channel"}
    </button>
  );
}

export function MessagingSettingsForm({
  employeeId,
  channel,
}: {
  employeeId: string;
  channel: EmployeeChannel;
}) {
  const [state, formAction] = useFormState(
    updateMessagingChannelAction,
    {} as MessagingActionState,
  );
  const config = channel.providerConfig as { senderId?: string; domain?: string };

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="channelId" value={channel.id} />
      <input type="hidden" name="channelType" value={channel.channelType} />

      <Field label="Channel name" htmlFor="name">
        <Input id="name" name="name" defaultValue={channel.name} maxLength={80} />
      </Field>

      <Field
        label={SENDER_ID_LABELS[channel.channelType] ?? "Sender identifier"}
        htmlFor="senderId"
      >
        <Input id="senderId" name="senderId" defaultValue={config.senderId ?? ""} maxLength={200} />
      </Field>

      {channel.channelProvider === "mailgun" ? (
        <Field label="Mailgun domain" htmlFor="domain" optional>
          <Input id="domain" name="domain" defaultValue={config.domain ?? ""} maxLength={200} />
        </Field>
      ) : null}

      <Field label="Welcome message" htmlFor="welcomeMessage" optional>
        <Input
          id="welcomeMessage"
          name="welcomeMessage"
          defaultValue={channel.welcomeMessage ?? ""}
          maxLength={500}
        />
      </Field>

      {state?.ok ? <Notice>Channel saved.</Notice> : null}
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
      <SubmitButton />
    </form>
  );
}
