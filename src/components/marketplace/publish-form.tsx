"use client";

/**
 * Publish an AI Employee to the marketplace (Sprint 030–031). Captures a fresh
 * snapshot of the employee's published DNA + performance; optionally includes
 * descriptions of the vaults it uses (never their content). Copy can be written
 * by AI ("Generate with AI") from the employee's DNA.
 */

import { useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  publishListingAction,
  generateListingCopyAction,
  type MarketplaceActionState,
} from "@/modules/marketplace/actions";
import { buttonClasses, Field, FieldError, Input, Textarea } from "@/components/ui";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
      {pending ? "Publishing…" : label}
    </button>
  );
}

export function PublishForm({
  employeeId,
  defaultTitle,
  defaultHeadline,
  defaultSummary,
  includeVaults,
  alreadyPublished,
}: {
  employeeId: string;
  defaultTitle: string;
  defaultHeadline?: string;
  defaultSummary?: string;
  includeVaults?: boolean;
  alreadyPublished?: boolean;
}) {
  const [state, action] = useFormState(publishListingAction, {} as MarketplaceActionState);
  const [headline, setHeadline] = useState(defaultHeadline ?? "");
  const [summary, setSummary] = useState(defaultSummary ?? "");
  const [withVaults, setWithVaults] = useState(!!includeVaults);
  const [genError, setGenError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();

  function generate() {
    setGenError(null);
    startGenerating(async () => {
      const res = await generateListingCopyAction(employeeId);
      if (res.error) {
        setGenError(res.error);
        return;
      }
      if (res.headline) setHeadline(res.headline);
      if (res.summary) setSummary(res.summary);
    });
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="employeeId" value={employeeId} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-taurus-sub">
          Write a compelling resume, or let AI draft it from this AI Employee&apos;s DNA.
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className={buttonClasses("secondary")}
        >
          {generating ? "Writing…" : "✨ Generate with AI"}
        </button>
      </div>
      {genError ? <FieldError>{genError}</FieldError> : null}

      <Field label="Public title" htmlFor="mk-title">
        <Input id="mk-title" name="title" defaultValue={defaultTitle} required minLength={2} />
      </Field>
      <Field label="Headline" htmlFor="mk-headline" optional hint="One line shown on the marketplace card.">
        <Input
          id="mk-headline"
          name="headline"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="e.g. Tier-1 support specialist grounded in best-practice playbooks"
        />
      </Field>
      <Field label="Summary" htmlFor="mk-summary" optional hint="A short paragraph for the resume.">
        <Textarea
          id="mk-summary"
          name="summary"
          rows={4}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-taurus-text">
        <input
          type="checkbox"
          name="includeVaults"
          checked={withVaults}
          onChange={(e) => setWithVaults(e.target.checked)}
        />
        Include descriptions of the knowledge vaults this AI Employee uses (content is never shared)
      </label>
      {withVaults ? (
        <label className="ml-6 flex items-center gap-2 text-sm text-taurus-sub">
          <input type="checkbox" name="autoDescribeVaults" defaultChecked />
          Let AI describe any vault that has no description yet
        </label>
      ) : null}

      {state?.error ? <FieldError>{state.error}</FieldError> : null}
      <SubmitButton label={alreadyPublished ? "Re-publish (refresh snapshot)" : "Publish to marketplace"} />
    </form>
  );
}
