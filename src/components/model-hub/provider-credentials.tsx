"use client";

/**
 * Provider credentials panel (Prompt 006B).
 *
 * Shows, per provider: whether a Taurus-managed key is available, and the
 * bring-your-own-key (BYOK) status. Only the last four characters of a saved key
 * are ever shown — never the full key or the encrypted value. BYOK entry is
 * disabled unless secure key storage is configured on the server.
 */

import { useFormState, useFormStatus } from "react-dom";
import {
  saveProviderCredentialAction,
  disableProviderCredentialAction,
  type ModelHubActionState,
} from "@/modules/model-gateway/actions";
import { Badge, buttonClasses, Card, FieldError, Input } from "@/components/ui";

export interface ProviderCredentialView {
  slug: string;
  displayName: string;
  supportsByok: boolean;
  supportsPlatformKey: boolean;
  platformAvailable: boolean;
  documentationUrl: string | null;
  credentialMode: "taurus_managed" | "bring_your_own_key" | "disabled" | null;
  status: "active" | "disabled" | "error" | null;
  keyLastFour: string | null;
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

function ProviderRow({
  item,
  encryptionConfigured,
  canManage,
}: {
  item: ProviderCredentialView;
  encryptionConfigured: boolean;
  canManage: boolean;
}) {
  const [saveState, saveAction] = useFormState(
    saveProviderCredentialAction,
    {} as ModelHubActionState,
  );
  const [, disableAction] = useFormState(
    disableProviderCredentialAction,
    {} as ModelHubActionState,
  );

  const hasByok = item.credentialMode === "bring_your_own_key" && item.status === "active";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-taurus-text">{item.displayName}</h3>
          {item.platformAvailable ? (
            <Badge tone="soft">Taurus managed: Available</Badge>
          ) : (
            <Badge tone="outline">Taurus managed: Not available</Badge>
          )}
          {hasByok ? <Badge tone="solid">Your key •••• {item.keyLastFour}</Badge> : null}
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
      ) : (
        <div className="mt-4 space-y-3">
          <form action={saveAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="providerSlug" value={item.slug} />
            <div className="min-w-[220px] flex-1">
              <label
                htmlFor={`apiKey-${item.slug}`}
                className="mb-1 block text-xs font-medium text-taurus-sub"
              >
                {hasByok ? "Replace your API key" : "Add your API key"}
              </label>
              <Input
                id={`apiKey-${item.slug}`}
                name="apiKey"
                type="password"
                autoComplete="off"
                placeholder="sk-…"
                minLength={8}
              />
            </div>
            <SaveButton />
          </form>
          {saveState?.error ? <FieldError>{saveState.error}</FieldError> : null}
          {hasByok ? (
            <form action={disableAction}>
              <input type="hidden" name="providerSlug" value={item.slug} />
              <DisableButton />
            </form>
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
}: {
  items: ProviderCredentialView[];
  encryptionConfigured: boolean;
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <ProviderRow
          key={item.slug}
          item={item}
          encryptionConfigured={encryptionConfigured}
          canManage={canManage}
        />
      ))}
    </div>
  );
}
