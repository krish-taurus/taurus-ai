"use client";

/**
 * Voice Channel setup form (Prompt 010).
 *
 * Handles both create and edit. Plain-language fields only — no technical jargon.
 * All values are validated + re-checked server-side.
 */

import { useFormState, useFormStatus } from "react-dom";
import type { EmployeeChannel } from "@/lib/db/types";
import {
  createVoiceChannelAction,
  updateVoiceChannelAction,
  type VoiceActionState,
} from "@/modules/voice-runtime/actions";
import {
  RECORDING_SETTINGS,
  TRANSCRIPT_SETTINGS,
  VOICE_PROVIDER_LABELS,
  VOICE_PROVIDER_TYPES,
  VOICE_STYLES,
  readVoiceConfig,
} from "@/modules/voice-runtime/catalog";
import { STT_PROVIDER_LABELS, STT_PROVIDER_TYPES } from "@/modules/voice-runtime/stt";
import { TTS_PROVIDER_LABELS, TTS_PROVIDER_TYPES } from "@/modules/voice-runtime/tts";
import {
  buttonClasses,
  Field,
  FieldError,
  FormSection,
  Input,
  Notice,
  Select,
  Textarea,
} from "@/components/ui";

function SubmitButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
      {pending ? "Saving…" : isNew ? "Create Voice Channel" : "Save Voice Channel"}
    </button>
  );
}

export function VoiceChannelForm({
  employeeId,
  employeeName,
  channel,
  phoneNumber,
}: {
  employeeId: string;
  employeeName: string;
  channel: EmployeeChannel | null;
  phoneNumber: string | null;
}) {
  const isNew = !channel;
  const [state, formAction] = useFormState(
    isNew ? createVoiceChannelAction : updateVoiceChannelAction,
    {} as VoiceActionState,
  );
  const config = channel ? readVoiceConfig(channel.providerConfig ?? {}) : null;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="employeeId" value={employeeId} />
      {channel ? <input type="hidden" name="channelId" value={channel.id} /> : null}

      <FormSection title="Basics" description="How this Voice Channel introduces your AI Employee.">
        <Field label="Channel name" htmlFor="name">
          <Input
            id="name"
            name="name"
            defaultValue={channel?.name ?? `${employeeName} — Phone`}
            maxLength={80}
          />
        </Field>
        {isNew ? (
          <Field label="Provider" htmlFor="provider" hint="Start with Simulated to test safely.">
            <Select id="provider" name="provider" defaultValue="simulated_voice">
              {VOICE_PROVIDER_TYPES.map((p) => (
                <option key={p} value={p}>
                  {VOICE_PROVIDER_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="provider" value={channel!.channelProvider} />
        )}
        <Field label="Welcome message" htmlFor="welcomeMessage" optional>
          <Textarea
            id="welcomeMessage"
            name="welcomeMessage"
            rows={2}
            defaultValue={channel?.welcomeMessage ?? ""}
            maxLength={500}
            placeholder="Hi, thanks for calling! How can I help?"
          />
        </Field>
      </FormSection>

      <FormSection title="Phone number" description="The number callers dial.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Phone number" htmlFor="phoneNumber" optional>
            <Input
              id="phoneNumber"
              name="phoneNumber"
              defaultValue={phoneNumber ?? ""}
              placeholder="+15551234567"
              maxLength={40}
            />
          </Field>
          <Field label="Phone number label" htmlFor="phoneNumberLabel" optional>
            <Input id="phoneNumberLabel" name="phoneNumberLabel" maxLength={80} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Voice" description="How your AI Employee sounds and understands callers.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Voice style" htmlFor="voiceStyle">
            <Select
              id="voiceStyle"
              name="voiceStyle"
              defaultValue={config?.voiceStyle ?? "Professional"}
            >
              {VOICE_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Speech understanding" htmlFor="sttProvider">
            <Select
              id="sttProvider"
              name="sttProvider"
              defaultValue={config?.sttProvider ?? "simulated_stt"}
            >
              {STT_PROVIDER_TYPES.map((p) => (
                <option key={p} value={p}>
                  {STT_PROVIDER_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Speaking voice" htmlFor="ttsProvider">
            <Select
              id="ttsProvider"
              name="ttsProvider"
              defaultValue={config?.ttsProvider ?? "simulated_tts"}
            >
              {TTS_PROVIDER_TYPES.map((p) => (
                <option key={p} value={p}>
                  {TTS_PROVIDER_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormSection title="Recording & transcript" description="What is kept from each call.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Call recording" htmlFor="recordingSetting">
            <Select
              id="recordingSetting"
              name="recordingSetting"
              defaultValue={config?.recordingSetting ?? "disabled"}
            >
              {RECORDING_SETTINGS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Call transcript" htmlFor="transcriptSetting">
            <Select
              id="transcriptSetting"
              name="transcriptSetting"
              defaultValue={config?.transcriptSetting ?? "save_transcript"}
            >
              {TRANSCRIPT_SETTINGS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FormSection>

      <FormSection title="Availability" description="Optional notes for how calls are handled.">
        <Field label="Business hours" htmlFor="businessHours" optional>
          <Input
            id="businessHours"
            name="businessHours"
            defaultValue={config?.businessHours ?? ""}
            placeholder="Mon–Fri, 9am–5pm"
            maxLength={200}
          />
        </Field>
        <Field label="Escalation note" htmlFor="escalationNote" optional>
          <Textarea
            id="escalationNote"
            name="escalationNote"
            rows={2}
            defaultValue={config?.escalationNote ?? ""}
            maxLength={500}
            placeholder="When to hand off to a human (foundation — not automated yet)."
          />
        </Field>
      </FormSection>

      {state?.ok ? <Notice>Voice Channel saved.</Notice> : null}
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
      <SubmitButton isNew={isNew} />
    </form>
  );
}
