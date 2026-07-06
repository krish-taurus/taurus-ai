"use client";

/**
 * Add Knowledge forms (Prompt 006).
 *
 * A segmented control to choose Add Text / Upload File / Add Website, each
 * posting to its own server action. Business-friendly copy; no technical
 * retrieval terminology.
 */

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  createFileSourceAction,
  createTextSourceAction,
  createUrlSourceAction,
  type KnowledgeActionState,
} from "@/modules/knowledge/actions";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/modules/knowledge/metadata";
import { buttonClasses, cn, Field, FieldError, Input, Select, Textarea } from "@/components/ui";

type Tab = "text" | "file" | "url";

const TABS: { key: Tab; label: string }[] = [
  { key: "text", label: "Add Text" },
  { key: "file", label: "Upload File" },
  { key: "url", label: "Add Website" },
];

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

export function CreateKnowledgeForms() {
  const [tab, setTab] = useState<Tab>("text");
  const [textState, textAction] = useFormState(createTextSourceAction, {} as KnowledgeActionState);
  const [fileState, fileAction] = useFormState(createFileSourceAction, {} as KnowledgeActionState);
  const [urlState, urlAction] = useFormState(createUrlSourceAction, {} as KnowledgeActionState);

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
            hint="We save the address now. Reading the website automatically is coming in a later step."
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
    </div>
  );
}
