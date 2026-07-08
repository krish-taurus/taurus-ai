"use client";

/**
 * Provider credentials panel (Prompt 006B; BYOK setup in Sprint 013).
 *
 * Per provider: whether a Taurus-managed key is available, the bring-your-own-key
 * (BYOK) status, and a setup form to add your own key — with an optional custom
 * base URL (OpenAI-compatible endpoints), an optional label, a masked key
 * display, remove, and an optional connection test.
 *
 * SECURITY: only the last four characters of a saved key are ever shown — never
 * the full key or the encrypted value. BYOK entry is disabled unless secure key
 * storage is configured on the server.
 */

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import {
  saveProviderCredentialAction,
  disableProviderCredentialAction,
  testProviderConnectionAction,
  type ModelHubActionState,
} from "@/modules/model-gateway/actions";
import { Badge, buttonClasses, Card, Field, FieldError, Input, Notice } from "@/components/ui";

/** Where owners/admins go to change their plan. */
const PLANS_HREF = "/dashboard/settings/billing/plans";

export interface ProviderCredentialView {
  slug: string;
  displayName: string;
  supportsByok: boolean;
  supportsPlatformKey: boolean;
  platformAvailable: boolean;
  documentationUrl: string | null;
  requiresBaseUrl: boolean;
  credentialMode: "taurus_managed" | "bring_your_own_key" | "disabled" | null;
  status: "active" | "disabled" | "error" | null;
  keyLastFour: string | null;
  baseUrl: string | null;
  label: string | null;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "sm")}>
      {pending ? "Saving…" : "Save key"}
    </button>
  );
}

function DisableButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("ghost", "sm")}>
      {pending ? "Removing…" : "Remove key"}
    </button>
  );
}

function TestButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("secondary", "sm")}>
      {pending ? "Testing…" : "Test connection"}
    </button>
  );
}

function StatusBadge({ status }: { status: "active" | "disabled" | "error" }) {
  if (status === "active") return <Badge tone="solid">Status: Active</Badge>;
  if (status === "error") return <Badge tone="outline">Status: Error</Badge>;
  return <Badge tone="outline">Status: Disabled</Badge>;
}

function ProviderRow({
  item,
  encryptionConfigured,
  canManage,
  byokAvailable,
}: {
  item: ProviderCredentialView;
  encryptionConfigured: boolean;
  canManage: boolean;
  byokAvailable: boolean;
}) {
  const [saveState, saveAction] = useFormState(
    saveProviderCredentialAction,
    {} as ModelHubActionState,
  );
  const [, disableAction] = useFormState(
    disableProviderCredentialAction,
    {} as ModelHubActionState,
  );
  const [testState, testAction] = useFormState(
    testProviderConnectionAction,
    {} as ModelHubActionState,
  );

  const hasByok = item.credentialMode === "bring_your_own_key" && item.status === "active";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-taurus-text">{item.displayName}</h3>
          {item.platformAvailable ? (
            <Badge tone="soft">Taurus managed: Available</Badge>
          ) : (
            <Badge tone="outline">Taurus managed: Not available</Badge>
          )}
          {hasByok ? <Badge tone="solid">Your key •••• {item.keyLastFour}</Badge> : null}
          {item.credentialMode === "bring_your_own_key" && item.status ? (
            <StatusBadge status={item.status} />
          ) : null}
          {hasByok && item.label ? <Badge tone="outline">{item.label}</Badge> : null}
        </div>
        {item.documentationUrl ? (
          <a
            href={item.documentationUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-taurus-sub underline-offset-2 hover:underline"
          >
            Provider docs
          </a>
        ) : null}
      </div>

      {hasByok && item.baseUrl ? (
        <p className="mt-2 text-xs text-taurus-faint">Endpoint: {item.baseUrl}</p>
      ) : null}

      {!item.supportsByok ? (
        <p className="mt-3 text-sm text-taurus-faint">
          This provider does not support your own key.
        </p>
      ) : !encryptionConfigured ? (
        <p className="mt-3 rounded-lg border border-taurus-line bg-taurus-muted px-3 py-2 text-sm text-taurus-faint">
          Secure key storage is not configured, so bringing your own key is disabled. Taurus-managed
          keys still work when available.
        </p>
      ) : !canManage ? (
        <p className="mt-3 text-sm text-taurus-faint">
          Only owners and admins can manage provider keys.
        </p>
      ) : !byokAvailable ? (
        <div className="mt-3 rounded-lg border border-taurus-line bg-taurus-muted px-4 py-4">
          <p className="text-sm text-taurus-text">
            Bringing your own model provider keys is available on the Growth and Scale plans.
          </p>
          <p className="mt-1 text-sm text-taurus-sub">
            Upgrade your plan to connect your own keys.
          </p>
          <Link href={PLANS_HREF} className={buttonClasses("primary", "sm", "mt-3")}>
            Upgrade plan
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <form action={saveAction} className="space-y-3">
            <input type="hidden" name="providerSlug" value={item.slug} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label={hasByok ? "Replace your API key" : "Add your API key"}
                htmlFor={`apiKey-${item.slug}`}
              >
                <Input
                  id={`apiKey-${item.slug}`}
                  name="apiKey"
                  type="password"
                  autoComplete="off"
                  placeholder="sk-…"
                  minLength={8}
                />
              </Field>
              <Field label="Label" htmlFor={`label-${item.slug}`} optional>
                <Input
                  id={`label-${item.slug}`}
                  name="label"
                  type="text"
                  maxLength={80}
                  placeholder="e.g. Finance team key"
                  defaultValue={item.label ?? ""}
                />
              </Field>
            </div>

            {item.requiresBaseUrl ? (
              <Field
                label="Base URL"
                htmlFor={`baseUrl-${item.slug}`}
                hint="Your OpenAI-compatible endpoint, e.g. https://api.example.com/v1."
              >
                <Input
                  id={`baseUrl-${item.slug}`}
                  name="baseUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://api.example.com/v1"
                  defaultValue={item.baseUrl ?? ""}
                />
              </Field>
            ) : null}

            <p className="text-xs text-taurus-faint">
              Your API key is encrypted and never shown again. We only display the last four
              characters.
            </p>

            {saveState?.error ? <FieldError>{saveState.error}</FieldError> : null}
            {saveState?.ok ? (
              <Notice>{saveState.message ?? "Key saved. Use “Test connection” below to verify it."}</Notice>
            ) : null}
            <SaveButton />
          </form>

          {hasByok ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-taurus-line pt-3">
              <form action={testAction}>
                <input type="hidden" name="providerSlug" value={item.slug} />
                <TestButton />
              </form>
              <form action={disableAction}>
                <input type="hidden" name="providerSlug" value={item.slug} />
                <DisableButton />
              </form>
            </div>
          ) : null}

          {testState?.error ? <FieldError>{testState.error}</FieldError> : null}
          {testState?.message && !testState.error ? (
            testState.ok ? (
              <Notice>{testState.message}</Notice>
            ) : (
              <p className="text-sm text-taurus-sub">{testState.message}</p>
            )
          ) : null}
        </div>
      )}
    </Card>
  );
}

export function ProviderCredentialsPanel({
  items,
  encryptionConfigured,
  canManage,
  byokAvailable,
}: {
  items: ProviderCredentialView[];
  encryptionConfigured: boolean;
  canManage: boolean;
  byokAvailable: boolean;
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ProviderRow
          key={item.slug}
          item={item}
          encryptionConfigured={encryptionConfigured}
          canManage={canManage}
          byokAvailable={byokAvailable}
        />
      ))}
    </div>
  );
}
