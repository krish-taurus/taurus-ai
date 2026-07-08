"use client";

/**
 * "Choose plan" button (Sprint 015). Posts a catalog plan id to the server
 * action, which either applies a simulated upgrade or redirects to Stripe
 * Checkout. The plan id is the only client input; the organization is resolved
 * server-side.
 */

import { useFormState, useFormStatus } from "react-dom";
import { choosePlanAction, type BillingActionState } from "@/modules/billing/actions";
import { buttonClasses, FieldError } from "@/components/ui";
import type { ButtonVariant } from "@/components/ui/button";

function SubmitButton({ label, variant }: { label: string; variant: ButtonVariant }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses(variant, "md", "w-full")}>
      {pending ? "Working…" : label}
    </button>
  );
}

export function ChoosePlanButton({
  planId,
  label = "Choose plan",
  variant = "primary",
}: {
  planId: string;
  label?: string;
  variant?: ButtonVariant;
}) {
  const [state, formAction] = useFormState(choosePlanAction, {} as BillingActionState);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="planId" value={planId} />
      <SubmitButton label={label} variant={variant} />
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
