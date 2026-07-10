"use client";

/**
 * Workflow trigger panel (Sprint 049/050): choose how a workflow starts —
 * manually, from a webhook URL, on a schedule, or when a message arrives on a
 * connected channel. Each option is a small server-action form.
 */

import { useFormState, useFormStatus } from "react-dom";
import { setWorkflowTriggerAction, type WorkflowActionState } from "@/modules/workflows/actions";
import type { ChannelOption } from "@/components/workflows/workflow-builder";
import { buttonClasses, FieldError, Input, Label, Select } from "@/components/ui";

type TriggerType = "manual" | "webhook" | "schedule" | "channel";

const TABS: { kind: TriggerType; label: string }[] = [
  { kind: "manual", label: "Manual" },
  { kind: "webhook", label: "Webhook" },
  { kind: "schedule", label: "Schedule" },
  { kind: "channel", label: "Channel" },
];

const CADENCES: { minutes: number; label: string }[] = [
  { minutes: 15, label: "Every 15 minutes" },
  { minutes: 60, label: "Every hour" },
  { minutes: 360, label: "Every 6 hours" },
  { minutes: 1440, label: "Every day" },
];

function SetButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("secondary", "sm")}>
      {pending ? "Saving…" : label}
    </button>
  );
}

export function TriggerPanel({
  workflowId,
  triggerType,
  webhookUrl,
  everyMinutes,
  channelId,
  channels,
}: {
  workflowId: string;
  triggerType: TriggerType;
  webhookUrl: string | null;
  everyMinutes: number | null;
  channelId: string | null;
  channels: ChannelOption[];
}) {
  const [state, action] = useFormState(setWorkflowTriggerAction, {} as WorkflowActionState);

  return (
    <div className="flex flex-col gap-3">
      {/* Trigger type switcher */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <form key={t.kind} action={action}>
            <input type="hidden" name="workflowId" value={workflowId} />
            <input type="hidden" name="kind" value={t.kind} />
            {t.kind === "schedule" ? <input type="hidden" name="everyMinutes" value={everyMinutes ?? 60} /> : null}
            {t.kind === "channel" ? <input type="hidden" name="channelId" value={channelId ?? channels[0]?.id ?? ""} /> : null}
            <button
              type="submit"
              disabled={t.kind === "channel" && channels.length === 0}
              className={
                triggerType === t.kind
                  ? buttonClasses("primary", "sm")
                  : buttonClasses("outline", "sm")
              }
            >
              {t.label}
            </button>
          </form>
        ))}
      </div>
      {state?.error ? <FieldError>{state.error}</FieldError> : null}

      {/* Per-type detail */}
      {triggerType === "manual" ? (
        <p className="text-xs text-taurus-faint">Starts when you click Run now.</p>
      ) : null}

      {triggerType === "webhook" && webhookUrl ? (
        <div className="flex flex-col gap-1">
          <Input readOnly value={webhookUrl} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
          <p className="text-xs text-taurus-faint">
            Keep this URL secret. It only fires while the workflow is active. POST a JSON body like{" "}
            <code>{`{"message":"…"}`}</code>.
          </p>
        </div>
      ) : null}

      {triggerType === "schedule" ? (
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="workflowId" value={workflowId} />
          <input type="hidden" name="kind" value="schedule" />
          <Label htmlFor="cadence">How often</Label>
          <Select id="cadence" name="everyMinutes" defaultValue={String(everyMinutes ?? 60)}>
            {CADENCES.map((c) => (
              <option key={c.minutes} value={c.minutes}>
                {c.label}
              </option>
            ))}
          </Select>
          <SetButton label="Save schedule" />
          <p className="text-xs text-taurus-faint">
            Runs only while active, and needs the scheduler configured (an external timer calls the
            tick endpoint). See the deploy notes.
          </p>
        </form>
      ) : null}

      {triggerType === "channel" ? (
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="workflowId" value={workflowId} />
          <input type="hidden" name="kind" value="channel" />
          <Label htmlFor="trigger-channel">When a message arrives on</Label>
          {channels.length === 0 ? (
            <p className="text-xs text-taurus-faint">
              No messaging channels connected. Set one up under Connections first.
            </p>
          ) : (
            <>
              <Select id="trigger-channel" name="channelId" defaultValue={channelId ?? channels[0]?.id}>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
              <SetButton label="Save channel" />
              <p className="text-xs text-taurus-faint">
                The message starts this workflow instead of the employee&apos;s auto-reply — so add a
                Send message step (to <code>{`{{trigger.sender}}`}</code>) to respond.
              </p>
            </>
          )}
        </form>
      ) : null}
    </div>
  );
}
