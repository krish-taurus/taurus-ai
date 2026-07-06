"use client";

/** Activate / pause / revoke a messaging channel (Prompt 009). */

import { useFormState, useFormStatus } from "react-dom";
import type { ChannelStatus } from "@/lib/db/types";
import {
  activateMessagingChannelAction,
  archiveMessagingChannelAction,
  pauseMessagingChannelAction,
  type MessagingActionState,
} from "@/modules/channels/messaging/actions";
import { buttonClasses } from "@/components/ui";

function Btn({
  label,
  pendingLabel,
  variant,
  confirm,
}: {
  label: string;
  pendingLabel: string;
  variant: "primary" | "secondary" | "danger";
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClasses(variant, "sm")}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function MessagingStatusControls({
  employeeId,
  channelId,
  channelType,
  status,
}: {
  employeeId: string;
  channelId: string;
  channelType: string;
  status: ChannelStatus;
}) {
  const [, activate] = useFormState(activateMessagingChannelAction, {} as MessagingActionState);
  const [, pause] = useFormState(pauseMessagingChannelAction, {} as MessagingActionState);
  const [, archive] = useFormState(archiveMessagingChannelAction, {} as MessagingActionState);

  const hidden = (
    <>
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="channelId" value={channelId} />
      <input type="hidden" name="channelType" value={channelType} />
    </>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "active" && status !== "archived" ? (
        <form action={activate}>
          {hidden}
          <Btn label="Activate" pendingLabel="Activating…" variant="primary" />
        </form>
      ) : null}
      {status === "active" ? (
        <form action={pause}>
          {hidden}
          <Btn label="Pause" pendingLabel="Pausing…" variant="secondary" />
        </form>
      ) : null}
      {status !== "archived" ? (
        <form action={archive}>
          {hidden}
          <Btn
            label="Revoke"
            pendingLabel="Revoking…"
            variant="danger"
            confirm="Revoke this channel? Inbound messages will stop being answered."
          />
        </form>
      ) : null}
    </div>
  );
}
