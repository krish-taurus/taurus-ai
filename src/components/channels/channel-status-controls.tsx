"use client";

/** Activate / pause / revoke controls for a channel (Prompt 008). */

import { useFormState, useFormStatus } from "react-dom";
import {
  activateChannelAction,
  pauseChannelAction,
  archiveChannelAction,
  type ChannelActionState,
} from "@/modules/channels/actions";
import type { ChannelStatus } from "@/lib/db/types";
import { buttonClasses } from "@/components/ui";

function SubmitButton({
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

export function ChannelStatusControls({
  employeeId,
  channelId,
  status,
}: {
  employeeId: string;
  channelId: string;
  status: ChannelStatus;
}) {
  const [, activate] = useFormState(activateChannelAction, {} as ChannelActionState);
  const [, pause] = useFormState(pauseChannelAction, {} as ChannelActionState);
  const [, archive] = useFormState(archiveChannelAction, {} as ChannelActionState);

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "active" && status !== "archived" ? (
        <form action={activate}>
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="channelId" value={channelId} />
          <SubmitButton label="Activate" pendingLabel="Activating…" variant="primary" />
        </form>
      ) : null}

      {status === "active" ? (
        <form action={pause}>
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="channelId" value={channelId} />
          <SubmitButton label="Pause" pendingLabel="Pausing…" variant="secondary" />
        </form>
      ) : null}

      {status !== "archived" ? (
        <form action={archive}>
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="channelId" value={channelId} />
          <SubmitButton
            label="Revoke"
            pendingLabel="Revoking…"
            variant="danger"
            confirm="Revoke this channel? Existing embeds and links will stop working."
          />
        </form>
      ) : null}
    </div>
  );
}
