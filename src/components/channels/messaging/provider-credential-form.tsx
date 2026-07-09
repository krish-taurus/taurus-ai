"use client";

/**
 * Provider credential form (Prompt 009).
 *
 * Bring-your-own-key entry for a messaging provider. Only shown to owners/admins.
 * Disabled unless secure storage is configured. Secrets are write-only — only the
 * last four of a saved key is ever displayed.
 */

import { useFormState, useFormStatus } from "react-dom";
import type { ChannelProviderType } from "@/lib/db/types";
import {
  saveProviderCredentialAction,
  disableProviderCredentialAction,
  type MessagingActionState,
} from "@/modules/channels/messaging/actions";
import { MESSAGING_PROVIDER_LABELS } from "@/modules/channels/messaging/catalog";
import { buttonClasses, Card, Field, FieldError, Input, Notice } from "@/components/ui";

const FIELDS: Partial<
  Record<ChannelProviderType, { name: string; label: string; optional?: boolean }[]>
> = {
  twilio: [
    { name: "accountSid", label: "Account SID" },
    { name: "authToken", label: "Auth Token" },
    { name: "messagingServiceSid", label: "Messaging Service SID", optional: true },
  ],
  meta_whatsapp_cloud: [
    { name: "accessToken", label: "Access Token" },
    { name: "phoneNumberId", label: "Phone Number ID" },
    { name: "appSecret", label: "App Secret", optional: true },
    { name: "verifyToken", label: "Verify Token", optional: true },
  ],
  sendgrid: [
    { name: "apiKey", label: "API Key" },
    { name: "verificationKey", label: "Event Webhook Verification Key", optional: true },
  ],
  mailgun: [
    { name: "apiKey", label: "API Key" },
    { name: "domain", label: "Domain" },
    { name: "signingKey", label: "Signing Key", optional: true },
  ],
  telegram: [
    { name: "botToken", label: "Access Token (from @BotFather)" },
    { name: "webhookSecret", label: "Webhook Secret", optional: true },
  ],
  meta_messenger: [
    { name: "accessToken", label: "Page Access Token" },
    { name: "appSecret", label: "App Secret", optional: true },
    { name: "verifyToken", label: "Verify Token", optional: true },
  ],
  meta_instagram: [
    { name: "accessToken", label: "Page Access Token" },
    { name: "appSecret", label: "App Secret", optional: true },
    { name: "verifyToken", label: "Verify Token", optional: true },
  ],
  custom_webhook: [{ name: "apiKey", label: "Shared secret", optional: true }],
};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "sm")}>
      {pending ? "Saving…" : "Save credentials"}
    </button>
  );
}

export function ProviderCredentialForm({
  employeeId,
  channelType,
  providerType,
  encryptionConfigured,
  hasCredential,
  keyLastFour,
  envAvailable,
}: {
  employeeId: string;
  channelType: string;
  providerType: ChannelProviderType;
  encryptionConfigured: boolean;
  hasCredential: boolean;
  keyLastFour: string | null;
  envAvailable: boolean;
}) {
  const [saveState, saveAction] = useFormState(
    saveProviderCredentialAction,
    {} as MessagingActionState,
  );
  const [, disableAction] = useFormState(
    disableProviderCredentialAction,
    {} as MessagingActionState,
  );
  const fields = FIELDS[providerType] ?? [];
  const providerLabel = MESSAGING_PROVIDER_LABELS[providerType] ?? providerType;

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
          <input type="hidden" name="channelType" value={channelType} />
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
        <form action={disableAction} className="mt-3">
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="channelType" value={channelType} />
          <input type="hidden" name="providerType" value={providerType} />
          <button type="submit" className={buttonClasses("ghost", "sm")}>
            Remove key
          </button>
        </form>
      ) : null}
    </Card>
  );
}
