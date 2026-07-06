"use client";

/** Activate / pause / revoke a Voice Channel (Prompt 010). */

import { useFormState, useFormStatus } from "react-dom";
import type { ChannelStatus } from "@/lib/db/types";
import {
  activateVoiceChannelAction,
  archiveVoiceChannelAction,
  pauseVoiceChannelAction,
  type VoiceActionState,
} from "@/modules/voice-runtime/actions";
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

export function VoiceStatusControls({
  employeeId,
  channelId,
  status,
}: {
  employeeId: string;
  channelId: string;
  status: ChannelStatus;
}) {
  const [, activate] = useFormState(activateVoiceChannelAction, {} as VoiceActionState);
  const [, pause] = useFormState(pauseVoiceChannelAction, {} as VoiceActionState);
  const [, archive] = useFormState(archiveVoiceChannelAction, {} as VoiceActionState);

  const hidden = (
    <>
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="channelId" value={channelId} />
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
            confirm="Revoke this Voice Channel? Incoming calls will stop being answered."
          />
        </form>
      ) : null}
    </div>
  );
}
