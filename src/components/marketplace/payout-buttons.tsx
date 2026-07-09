"use client";

/**
 * Seller payout controls (Sprint 035): connect a payout account and withdraw an
 * available balance. Both surface their server-action error inline.
 */

import { useFormState, useFormStatus } from "react-dom";
import {
  startPayoutOnboardingAction,
  requestPayoutAction,
  type MarketplaceActionState,
} from "@/modules/marketplace/actions";
import type { MarketplacePaymentProviderId } from "@/lib/db/types";
import { buttonClasses, FieldError } from "@/components/ui";

function Submit({
  label,
  busy,
  variant = "primary",
  name,
  value,
}: {
  label: string;
  busy: string;
  variant?: "primary" | "secondary";
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={buttonClasses(variant, "sm")}
    >
      {pending ? busy : label}
    </button>
  );
}

/** Connect a payout account. `providers` are the live options (empty → simulated demo). */
export function ConnectPayoutButton({
  providers,
  label = "Connect payout account",
}: {
  providers: MarketplacePaymentProviderId[];
  label?: string;
}) {
  const [state, action] = useFormState(startPayoutOnboardingAction, {} as MarketplaceActionState);
  const options: { id: MarketplacePaymentProviderId; label: string }[] =
    providers.length > 0
      ? providers.map((p) => ({
          id: p,
          label: p === "stripe" ? "Connect with Stripe" : "Connect with Razorpay",
        }))
      : [{ id: "simulated", label: `${label} (demo)` }];
  return (
    <form action={action} className="flex flex-col gap-2">
      {options.map((opt) => (
        <Submit key={opt.id} name="provider" value={opt.id} label={opt.label} busy="Connecting…" />
      ))}
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}

/** Withdraw the available balance in one currency. */
export function WithdrawButton({ currency, label }: { currency: string; label: string }) {
  const [state, action] = useFormState(requestPayoutAction, {} as MarketplaceActionState);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="currency" value={currency} />
      <Submit label={label} busy="Withdrawing…" />
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
