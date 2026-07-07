"use client";

/**
 * "Manage plan" button (Prompt 011). Opens the Stripe billing portal, or in
 * simulated mode returns to the billing page with a notice. Owner/admin only —
 * re-checked server-side.
 */

import { useFormState, useFormStatus } from "react-dom";
import { manageBillingAction, type BillingActionState } from "@/modules/billing/actions";
import { buttonClasses, FieldError } from "@/components/ui";
import type { ButtonVariant } from "@/components/ui/button";

function SubmitButton({ label, variant }: { label: string; variant: ButtonVariant }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses(variant, "md")}>
      {pending ? "Opening…" : label}
    </button>
  );
}

export function ManageBillingButton({
  label = "Manage plan",
  variant = "secondary",
}: {
  label?: string;
  variant?: ButtonVariant;
}) {
  const [state, formAction] = useFormState(manageBillingAction, {} as BillingActionState);
  return (
    <form action={formAction} className="space-y-2">
      <SubmitButton label={label} variant={variant} />
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
