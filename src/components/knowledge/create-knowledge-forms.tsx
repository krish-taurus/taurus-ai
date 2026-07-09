"use client";

/**
 * Add Knowledge forms (Prompt 006).
 *
 * A segmented control to choose Add Text / Upload File / Add Website, each
 * posting to its own server action. Business-friendly copy; no technical
 * retrieval terminology.
 */

import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import {
  createCloudStorageSourceAction,
  createDatabaseSourceAction,
  createFileSourceAction,
  createGoogleDriveSourceAction,
  createSharePointSourceAction,
  createTextSourceAction,
  createUrlSourceAction,
  type KnowledgeActionState,
} from "@/modules/knowledge/actions";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/modules/knowledge/metadata";
import { buttonClasses, cn, Field, FieldError, Input, Select, Textarea } from "@/components/ui";

type Tab =
  | "text"
  | "file"
  | "url"
  | "database"
  | "google_drive"
  | "cloud_storage"
  | "sharepoint";

const TABS: { key: Tab; label: string }[] = [
  { key: "text", label: "Add Text" },
  { key: "file", label: "Upload File" },
  { key: "url", label: "Add Website" },
  { key: "database", label: "Connect Database" },
  { key: "google_drive", label: "Google Drive" },
  { key: "cloud_storage", label: "Cloud Storage" },
  { key: "sharepoint", label: "SharePoint / OneDrive" },
];

const GOOGLE_DRIVE_START = "/api/knowledge/connectors/google-drive/start";
const SHAREPOINT_START = "/api/knowledge/connectors/sharepoint/start";

/** Connection state for an OAuth connector tab, resolved on the server. */
export interface OAuthConnectState {
  configured: boolean;
  connected: boolean;
  email: string | null;
  /** Friendly message when a previous connect attempt failed. */
  errorMessage: string | null;
}
/** Kept as named aliases so pages can be explicit about which connector. */
export type GoogleDriveConnectState = OAuthConnectState;
export type SharePointConnectState = OAuthConnectState;

/** Copy + endpoints that differ between OAuth connectors. */
interface OAuthConnectConfig {
  startUrl: string;
  idPrefix: string;
  notConfiguredMessage: string;
  connectDescription: string;
  connectButtonLabel: string;
  revokeHint: string;
  linkLabel: string;
  linkHint: string;
  linkPlaceholder: string;
  submitLabel: string;
}

const MAX_MB = MAX_UPLOAD_BYTES / (1024 * 1024);

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
      {pending ? "Saving…" : label}
    </button>
  );
}

function VisibilityField() {
  return (
    <Field label="Who can see this?" htmlFor="visibility">
      <Select id="visibility" name="visibility" defaultValue="organization">
        <option value="organization">Everyone in the organization</option>
        <option value="private">Private (admins only)</option>
      </Select>
    </Field>
  );
}

/** A vault (collection) choice for the Add Knowledge picker. */
export interface VaultChoice {
  id: string;
  name: string;
}

/** Only one Add-Knowledge tab renders at a time, so a single fixed id is safe. */
function VaultField({ vaults, defaultVaultId }: { vaults: VaultChoice[]; defaultVaultId?: string }) {
  if (vaults.length === 0) return null; // no vaults yet → the source files into the default
  return (
    <Field label="Add to vault" htmlFor="vaultId">
      <Select id="vaultId" name="vaultId" defaultValue={defaultVaultId ?? vaults[0]?.id}>
        {vaults.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function CreateKnowledgeForms({
  defaultTab = "text",
  googleDrive,
  sharePoint,
  vaults = [],
  defaultVaultId,
}: {
  defaultTab?: Tab;
  googleDrive?: GoogleDriveConnectState;
  sharePoint?: SharePointConnectState;
  vaults?: VaultChoice[];
  defaultVaultId?: string;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [dbKind, setDbKind] = useState<"postgres" | "mysql">("postgres");
  const [csProvider, setCsProvider] = useState<"azure_blob" | "gcs" | "s3">("azure_blob");
  const [textState, textAction] = useFormState(createTextSourceAction, {} as KnowledgeActionState);
  const [fileState, fileAction] = useFormState(createFileSourceAction, {} as KnowledgeActionState);
  const [urlState, urlAction] = useFormState(createUrlSourceAction, {} as KnowledgeActionState);
  const [dbState, dbAction] = useFormState(createDatabaseSourceAction, {} as KnowledgeActionState);
  const [driveState, driveAction] = useFormState(
    createGoogleDriveSourceAction,
    {} as KnowledgeActionState,
  );
  const [csState, csAction] = useFormState(
    createCloudStorageSourceAction,
    {} as KnowledgeActionState,
  );
  const [spState, spAction] = useFormState(
    createSharePointSourceAction,
    {} as KnowledgeActionState,
  );

  return (
    <div>
      {/* Segmented control */}
      <div
        role="tablist"
        aria-label="Knowledge type"
        className="mb-6 inline-flex rounded-lg border border-taurus-line bg-taurus-elevated p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-taurus-primary text-taurus-onPrimary"
                : "text-taurus-sub hover:text-taurus-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "text" ? (
        <form action={textAction} className="space-y-5">
          <Field label="Name" htmlFor="text-name">
            <Input
              id="text-name"
              name="name"
              required
              minLength={2}
              placeholder="e.g. Refund policy"
            />
          </Field>
          <Field label="Description" htmlFor="text-description" optional>
            <Input
              id="text-description"
              name="description"
              placeholder="A short note about this knowledge"
            />
          </Field>
          <Field label="Text" htmlFor="text-content">
            <Textarea
              id="text-content"
              name="text"
              rows={8}
              required
              placeholder="Paste or write the knowledge here."
            />
          </Field>
          <VaultField vaults={vaults} defaultVaultId={defaultVaultId} />
      <VisibilityField />
          {textState?.error ? <FieldError>{textState.error}</FieldError> : null}
          <SubmitButton label="Save knowledge" />
        </form>
      ) : null}

      {tab === "file" ? (
        <form action={fileAction} className="space-y-5">
          <Field label="Name" htmlFor="file-name">
            <Input
              id="file-name"
              name="name"
              required
              minLength={2}
              placeholder="e.g. Employee handbook"
            />
          </Field>
          <Field label="Description" htmlFor="file-description" optional>
            <Input
              id="file-description"
              name="description"
              placeholder="A short note about this document"
            />
          </Field>
          <Field
            label="File"
            htmlFor="file-input"
            hint={`Allowed: ${ALLOWED_EXTENSIONS.join(", ")}. Maximum ${MAX_MB} MB.`}
          >
            <input
              id="file-input"
              name="file"
              type="file"
              required
              accept={ALLOWED_EXTENSIONS.join(",")}
              className="block w-full text-sm text-taurus-sub file:mr-4 file:rounded-md file:border file:border-taurus-line file:bg-taurus-elevated file:px-4 file:py-2 file:text-sm file:font-medium file:text-taurus-text hover:file:border-taurus-strong"
            />
          </Field>
          <VaultField vaults={vaults} defaultVaultId={defaultVaultId} />
      <VisibilityField />
          {fileState?.error ? <FieldError>{fileState.error}</FieldError> : null}
          <SubmitButton label="Upload file" />
        </form>
      ) : null}

      {tab === "url" ? (
        <form action={urlAction} className="space-y-5">
          <Field label="Name" htmlFor="url-name">
            <Input
              id="url-name"
              name="name"
              required
              minLength={2}
              placeholder="e.g. Help center"
            />
          </Field>
          <Field label="Description" htmlFor="url-description" optional>
            <Input
              id="url-description"
              name="description"
              placeholder="A short note about this website"
            />
          </Field>
          <Field
            label="Website address"
            htmlFor="url-input"
            hint="We fetch the page and save its text so your AI Employees can answer from it."
          >
            <Input
              id="url-input"
              name="url"
              type="url"
              required
              placeholder="https://example.com/help"
            />
          </Field>
          <VaultField vaults={vaults} defaultVaultId={defaultVaultId} />
      <VisibilityField />
          {urlState?.error ? <FieldError>{urlState.error}</FieldError> : null}
          <SubmitButton label="Save website" />
        </form>
      ) : null}

      {tab === "database" ? (
        <form action={dbAction} className="space-y-5">
          <Field label="Name" htmlFor="db-name">
            <Input id="db-name" name="name" required minLength={2} placeholder="e.g. Product catalog" />
          </Field>
          <Field label="Description" htmlFor="db-description" optional>
            <Input
              id="db-description"
              name="description"
              placeholder="A short note about this data"
            />
          </Field>
          <Field label="Database" htmlFor="db-kind">
            <Select
              id="db-kind"
              name="kind"
              value={dbKind}
              onChange={(e) => setDbKind(e.target.value as "postgres" | "mysql")}
            >
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL</option>
            </Select>
          </Field>
          <Field
            label="Connection string"
            htmlFor="db-connection"
            hint="Use a read-only user. Stored encrypted; only the host is ever shown."
          >
            <Input
              id="db-connection"
              name="connectionString"
              type="password"
              required
              placeholder={
                dbKind === "mysql"
                  ? "mysql://readonly:•••@host:3306/dbname"
                  : "postgres://readonly:•••@host:5432/dbname"
              }
            />
          </Field>
          <Field
            label="Read-only SQL query"
            htmlFor="db-query"
            hint="A single SELECT. Its rows are saved as searchable knowledge (up to 5,000 rows)."
          >
            <Textarea
              id="db-query"
              name="query"
              rows={5}
              required
              placeholder="SELECT question, answer FROM faqs WHERE published = true"
            />
          </Field>
          <VaultField vaults={vaults} defaultVaultId={defaultVaultId} />
      <VisibilityField />
          {dbState?.error ? <FieldError>{dbState.error}</FieldError> : null}
          <SubmitButton label="Connect & import" />
        </form>
      ) : null}

      {tab === "google_drive" ? (
        <OAuthConnectTab
          config={GOOGLE_DRIVE_CONFIG}
          state={googleDrive}
          action={driveAction}
          formState={driveState}
          vaults={vaults}
          defaultVaultId={defaultVaultId}
        />
      ) : null}

      {tab === "sharepoint" ? (
        <OAuthConnectTab
          config={SHAREPOINT_CONFIG}
          state={sharePoint}
          action={spAction}
          formState={spState}
          vaults={vaults}
          defaultVaultId={defaultVaultId}
        />
      ) : null}

      {tab === "cloud_storage" ? (
        <form action={csAction} className="space-y-5">
          <Field label="Name" htmlFor="cs-name">
            <Input id="cs-name" name="name" required minLength={2} placeholder="e.g. Policy documents" />
          </Field>
          <Field label="Description" htmlFor="cs-description" optional>
            <Input id="cs-description" name="description" placeholder="A short note about this data" />
          </Field>
          <Field label="Provider" htmlFor="cs-provider">
            <Select
              id="cs-provider"
              name="provider"
              value={csProvider}
              onChange={(e) => setCsProvider(e.target.value as "azure_blob" | "gcs" | "s3")}
            >
              <option value="azure_blob">Azure Blob Storage</option>
              <option value="gcs">Google Cloud Storage</option>
              <option value="s3">Amazon S3</option>
            </Select>
          </Field>

          {csProvider === "azure_blob" ? (
            <Field
              label="Container SAS URL"
              htmlFor="cs-azure"
              hint="A read + list SAS URL for the container. Stored encrypted; only the account/container is shown."
            >
              <Input
                id="cs-azure"
                name="azureSasUrl"
                type="password"
                required
                placeholder="https://acct.blob.core.windows.net/container?sv=…&sig=…"
              />
            </Field>
          ) : csProvider === "gcs" ? (
            <>
              <Field label="Bucket name" htmlFor="cs-bucket">
                <Input id="cs-bucket" name="gcsBucket" required placeholder="my-bucket" />
              </Field>
              <Field
                label="Service account JSON"
                htmlFor="cs-sa"
                hint="A read-only service-account key (Storage Object Viewer). Stored encrypted."
              >
                <Textarea
                  id="cs-sa"
                  name="gcsServiceAccount"
                  rows={5}
                  required
                  placeholder={'{ "type": "service_account", "client_email": "…", "private_key": "…" }'}
                />
              </Field>
            </>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Bucket name" htmlFor="cs-s3-bucket">
                  <Input id="cs-s3-bucket" name="s3Bucket" required placeholder="my-bucket" />
                </Field>
                <Field label="Region" htmlFor="cs-s3-region">
                  <Input id="cs-s3-region" name="s3Region" required placeholder="us-east-1" />
                </Field>
              </div>
              <Field label="Access key ID" htmlFor="cs-s3-key">
                <Input id="cs-s3-key" name="s3AccessKeyId" required placeholder="AKIA…" />
              </Field>
              <Field
                label="Secret access key"
                htmlFor="cs-s3-secret"
                hint="Use a least-privilege, read-only key. Stored encrypted."
              >
                <Input id="cs-s3-secret" name="s3SecretAccessKey" type="password" required />
              </Field>
              <Field label="Session token" htmlFor="cs-s3-token" optional hint="Only for temporary credentials.">
                <Input id="cs-s3-token" name="s3SessionToken" type="password" />
              </Field>
            </>
          )}

          <Field
            label="Folder prefix"
            htmlFor="cs-prefix"
            optional
            hint="Only import files under this path (up to 50 supported files)."
          >
            <Input id="cs-prefix" name="prefix" placeholder="reports/2026/" />
          </Field>
          <VaultField vaults={vaults} defaultVaultId={defaultVaultId} />
      <VisibilityField />
          {csState?.error ? <FieldError>{csState.error}</FieldError> : null}
          <SubmitButton label="Connect & import" />
        </form>
      ) : null}
    </div>
  );
}

const GOOGLE_DRIVE_CONFIG: OAuthConnectConfig = {
  startUrl: GOOGLE_DRIVE_START,
  idPrefix: "drive",
  notConfiguredMessage:
    "Google Drive isn’t set up for this workspace yet. An admin needs to add Google credentials before you can connect a Drive account.",
  connectDescription:
    "Connect a Google account (read-only) and import a file or a whole folder. Its text is saved so your AI Employees can answer from it.",
  connectButtonLabel: "Connect Google Drive",
  revokeHint: "We only request read-only access. You can revoke it any time from your Google account.",
  linkLabel: "Google Drive file or folder link",
  linkHint: "Paste a link to a file or a folder. Folders import supported files one level deep (up to 50).",
  linkPlaceholder: "https://drive.google.com/drive/folders/…",
  submitLabel: "Import from Drive",
};

const SHAREPOINT_CONFIG: OAuthConnectConfig = {
  startUrl: SHAREPOINT_START,
  idPrefix: "sp",
  notConfiguredMessage:
    "SharePoint / OneDrive isn’t set up for this workspace yet. An admin needs to add Microsoft credentials before you can connect an account.",
  connectDescription:
    "Connect a Microsoft account (read-only) and import a OneDrive or SharePoint file or folder from a sharing link. Its text is saved so your AI Employees can answer from it.",
  connectButtonLabel: "Connect Microsoft account",
  revokeHint: "We only request read-only access. You can revoke it any time from your Microsoft account.",
  linkLabel: "SharePoint or OneDrive sharing link",
  linkHint: "Paste a share link to a file or a folder. Folders import supported files one level deep (up to 50).",
  linkPlaceholder: "https://contoso.sharepoint.com/:f:/s/team/…",
  submitLabel: "Import from Microsoft",
};

/** Shared UI for a paste-a-link OAuth connector (Google Drive, SharePoint). */
function OAuthConnectTab({
  config,
  state,
  action,
  formState,
  vaults,
  defaultVaultId,
}: {
  config: OAuthConnectConfig;
  state?: OAuthConnectState;
  action: (formData: FormData) => void;
  formState: KnowledgeActionState;
  vaults: VaultChoice[];
  defaultVaultId?: string;
}) {
  if (!state?.configured) {
    return (
      <div className="rounded-lg border border-taurus-line bg-taurus-muted p-5 text-sm text-taurus-sub">
        {config.notConfiguredMessage}
      </div>
    );
  }

  if (!state.connected) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-taurus-sub">{config.connectDescription}</p>
        {state.errorMessage ? <FieldError>{state.errorMessage}</FieldError> : null}
        <a href={config.startUrl} className={buttonClasses("primary", "lg")}>
          {config.connectButtonLabel}
        </a>
        <p className="text-xs text-taurus-faint">{config.revokeHint}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-taurus-line bg-taurus-muted px-4 py-3 text-sm">
        <span className="text-taurus-text">Connected{state.email ? ` as ${state.email}` : ""}</span>
        <Link href={config.startUrl} className="font-medium text-taurus-sub hover:text-taurus-text">
          Use a different account
        </Link>
      </div>
      <Field label="Name" htmlFor={`${config.idPrefix}-name`}>
        <Input
          id={`${config.idPrefix}-name`}
          name="name"
          required
          minLength={2}
          placeholder="e.g. Sales playbooks"
        />
      </Field>
      <Field label="Description" htmlFor={`${config.idPrefix}-description`} optional>
        <Input
          id={`${config.idPrefix}-description`}
          name="description"
          placeholder="A short note about this data"
        />
      </Field>
      <Field label={config.linkLabel} htmlFor={`${config.idPrefix}-link`} hint={config.linkHint}>
        <Input
          id={`${config.idPrefix}-link`}
          name="link"
          required
          placeholder={config.linkPlaceholder}
        />
      </Field>
      <VaultField vaults={vaults} defaultVaultId={defaultVaultId} />
      <VisibilityField />
      {formState?.error ? <FieldError>{formState.error}</FieldError> : null}
      <SubmitButton label={config.submitLabel} />
    </form>
  );
}
