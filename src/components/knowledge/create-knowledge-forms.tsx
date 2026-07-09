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
  createDatabaseSourceAction,
  createFileSourceAction,
  createGoogleDriveSourceAction,
  createTextSourceAction,
  createUrlSourceAction,
  type KnowledgeActionState,
} from "@/modules/knowledge/actions";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/modules/knowledge/metadata";
import { buttonClasses, cn, Field, FieldError, Input, Select, Textarea } from "@/components/ui";

type Tab = "text" | "file" | "url" | "database" | "google_drive";

const TABS: { key: Tab; label: string }[] = [
  { key: "text", label: "Add Text" },
  { key: "file", label: "Upload File" },
  { key: "url", label: "Add Website" },
  { key: "database", label: "Connect Database" },
  { key: "google_drive", label: "Google Drive" },
];

const GOOGLE_DRIVE_START = "/api/knowledge/connectors/google-drive/start";

/** Connection state for the Google Drive tab, resolved on the server. */
export interface GoogleDriveConnectState {
  configured: boolean;
  connected: boolean;
  email: string | null;
  /** Friendly message when a previous connect attempt failed. */
  errorMessage: string | null;
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

export function CreateKnowledgeForms({
  defaultTab = "text",
  googleDrive,
}: {
  defaultTab?: Tab;
  googleDrive?: GoogleDriveConnectState;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [textState, textAction] = useFormState(createTextSourceAction, {} as KnowledgeActionState);
  const [fileState, fileAction] = useFormState(createFileSourceAction, {} as KnowledgeActionState);
  const [urlState, urlAction] = useFormState(createUrlSourceAction, {} as KnowledgeActionState);
  const [dbState, dbAction] = useFormState(createDatabaseSourceAction, {} as KnowledgeActionState);
  const [driveState, driveAction] = useFormState(
    createGoogleDriveSourceAction,
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
          <VisibilityField />
          {urlState?.error ? <FieldError>{urlState.error}</FieldError> : null}
          <SubmitButton label="Save website" />
        </form>
      ) : null}

      {tab === "database" ? (
        <form action={dbAction} className="space-y-5">
          <input type="hidden" name="kind" value="postgres" />
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
            <Select id="db-kind" name="kindDisplay" defaultValue="postgres" disabled>
              <option value="postgres">PostgreSQL</option>
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
              placeholder="postgres://readonly:•••@host:5432/dbname"
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
          <VisibilityField />
          {dbState?.error ? <FieldError>{dbState.error}</FieldError> : null}
          <SubmitButton label="Connect & import" />
        </form>
      ) : null}

      {tab === "google_drive" ? (
        <GoogleDriveTab state={googleDrive} action={driveAction} formState={driveState} />
      ) : null}
    </div>
  );
}

function GoogleDriveTab({
  state,
  action,
  formState,
}: {
  state?: GoogleDriveConnectState;
  action: (formData: FormData) => void;
  formState: KnowledgeActionState;
}) {
  if (!state?.configured) {
    return (
      <div className="rounded-lg border border-taurus-line bg-taurus-muted p-5 text-sm text-taurus-sub">
        Google Drive isn’t set up for this workspace yet. An admin needs to add Google credentials
        before you can connect a Drive account.
      </div>
    );
  }

  if (!state.connected) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-taurus-sub">
          Connect a Google account (read-only) and import a file or a whole folder. Its text is
          saved so your AI Employees can answer from it.
        </p>
        {state.errorMessage ? <FieldError>{state.errorMessage}</FieldError> : null}
        <a href={GOOGLE_DRIVE_START} className={buttonClasses("primary", "lg")}>
          Connect Google Drive
        </a>
        <p className="text-xs text-taurus-faint">
          We only request read-only access. You can revoke it any time from your Google account.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-taurus-line bg-taurus-muted px-4 py-3 text-sm">
        <span className="text-taurus-text">
          Connected{state.email ? ` as ${state.email}` : ""}
        </span>
        <Link href={GOOGLE_DRIVE_START} className="font-medium text-taurus-sub hover:text-taurus-text">
          Use a different account
        </Link>
      </div>
      <Field label="Name" htmlFor="drive-name">
        <Input id="drive-name" name="name" required minLength={2} placeholder="e.g. Sales playbooks" />
      </Field>
      <Field label="Description" htmlFor="drive-description" optional>
        <Input id="drive-description" name="description" placeholder="A short note about this data" />
      </Field>
      <Field
        label="Google Drive file or folder link"
        htmlFor="drive-link"
        hint="Paste a link to a file or a folder. Folders import supported files one level deep (up to 50)."
      >
        <Input
          id="drive-link"
          name="link"
          required
          placeholder="https://drive.google.com/drive/folders/…"
        />
      </Field>
      <VisibilityField />
      {formState?.error ? <FieldError>{formState.error}</FieldError> : null}
      <SubmitButton label="Import from Drive" />
    </form>
  );
}
