"use client";

/**
 * Voice provider credential form (Prompt 010).
 *
 * Bring-your-own-key entry for a voice provider (owner/admin only). Disabled
 * unless secure storage is configured. Secrets are write-only — only the last
 * four of a saved key is ever shown.
 */

import { useFormState, useFormStatus } from "react-dom";
import type { ChannelProviderType } from "@/lib/db/types";
import {
  disableVoiceCredentialAction,
  saveVoiceCredentialAction,
  type VoiceActionState,
} from "@/modules/voice-runtime/actions";
import { VOICE_PROVIDER_LABELS } from "@/modules/voice-runtime/catalog";
import type { VoiceProviderType } from "@/lib/db/types";
import { buttonClasses, Card, Field, FieldError, Input, Notice } from "@/components/ui";

const FIELDS: Partial<
  Record<ChannelProviderType, { name: string; label: string; optional?: boolean }[]>
> = {
  twilio_voice: [
    { name: "accountSid", label: "Account SID" },
    { name: "authToken", label: "Auth Token" },
  ],
  telnyx_voice: [
    { name: "apiKey", label: "API Key" },
    { name: "publicKey", label: "Public Key", optional: true },
  ],
  vonage_voice: [
    { name: "apiKey", label: "API Key" },
    { name: "apiSecret", label: "API Secret" },
  ],
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "sm")}>
      {pending ? "Saving…" : "Save credentials"}
    </button>
  );
}

function DisableButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("outline", "sm")}>
      {pending ? "Removing…" : "Remove your key"}
    </button>
  );
}

export function VoiceCredentialForm({
  employeeId,
  providerType,
  encryptionConfigured,
  hasCredential,
  keyLastFour,
  envAvailable,
}: {
  employeeId: string;
  providerType: ChannelProviderType;
  encryptionConfigured: boolean;
  hasCredential: boolean;
  keyLastFour: string | null;
  envAvailable: boolean;
}) {
  const [saveState, saveAction] = useFormState(saveVoiceCredentialAction, {} as VoiceActionState);
  const [disableState, disableAction] = useFormState(
    disableVoiceCredentialAction,
    {} as VoiceActionState,
  );
  const fields = FIELDS[providerType] ?? [];
  const providerLabel = VOICE_PROVIDER_LABELS[providerType as VoiceProviderType] ?? providerType;

  if (fields.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-taurus-text">{providerLabel}</h3>
        <p className="mt-1 text-xs text-taurus-faint">
          This provider runs in simulated mode and needs no credentials.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-taurus-text">{providerLabel} credentials</h3>
      <p className="mt-1 text-xs text-taurus-faint">
        {envAvailable
          ? "A Taurus-managed key is available for this provider."
          : "No Taurus-managed key is set for this provider."}
        {hasCredential ? ` Your own key is saved (ending ${keyLastFour ?? "••••"}).` : ""}
      </p>

      {!encryptionConfigured ? (
        <div className="mt-3">
          <Notice>
            Secure credential storage is not configured on this server, so bringing your own key is
            disabled. Taurus-managed keys still work when available.
          </Notice>
        </div>
      ) : (
        <form action={saveAction} className="mt-4 space-y-3">
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="providerType" value={providerType} />
          {fields.map((f) => (
            <Field key={f.name} label={f.label} htmlFor={f.name} optional={f.optional}>
              <Input id={f.name} name={f.name} type="password" autoComplete="off" />
            </Field>
          ))}
          <Field label="Label" htmlFor="credentialLabel" optional>
            <Input id="credentialLabel" name="credentialLabel" maxLength={80} />
          </Field>
          {saveState?.error ? <FieldError>{saveState.error}</FieldError> : null}
          {saveState?.ok ? <Notice>Credentials saved securely.</Notice> : null}
          <SaveButton />
        </form>
      )}

      {encryptionConfigured && hasCredential ? (
        <form
          action={disableAction}
          className="mt-3 flex flex-col gap-1 border-t border-taurus-line pt-3"
        >
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="providerType" value={providerType} />
          <DisableButton />
          {disableState?.error ? <FieldError>{disableState.error}</FieldError> : null}
          {disableState?.ok ? <Notice>Your key was removed.</Notice> : null}
        </form>
      ) : null}
    </Card>
  );
}
