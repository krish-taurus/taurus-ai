"use client";

/**
 * Publish an AI Employee to the marketplace (Sprint 030). Captures a fresh
 * snapshot of the employee's published DNA + performance; optionally includes
 * descriptions of the vaults it uses (never their content).
 */

import { useFormState, useFormStatus } from "react-dom";
import { publishListingAction, type MarketplaceActionState } from "@/modules/marketplace/actions";
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
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="employeeId" value={employeeId} />
      <Field label="Public title" htmlFor="mk-title">
        <Input id="mk-title" name="title" defaultValue={defaultTitle} required minLength={2} />
      </Field>
      <Field label="Headline" htmlFor="mk-headline" optional hint="One line shown on the marketplace card.">
        <Input
          id="mk-headline"
          name="headline"
          defaultValue={defaultHeadline}
          placeholder="e.g. Tier-1 support specialist with 92% review pass rate"
        />
      </Field>
      <Field label="Summary" htmlFor="mk-summary" optional hint="A short paragraph for the resume.">
        <Textarea id="mk-summary" name="summary" rows={4} defaultValue={defaultSummary} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-taurus-text">
        <input type="checkbox" name="includeVaults" defaultChecked={includeVaults} />
        Include descriptions of the knowledge vaults this AI Employee uses (content is never shared)
      </label>
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
      <SubmitButton label={alreadyPublished ? "Re-publish (refresh snapshot)" : "Publish to marketplace"} />
    </form>
  );
}
