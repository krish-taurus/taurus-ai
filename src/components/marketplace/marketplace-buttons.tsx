"use client";

/**
 * Marketplace client controls (Sprint 030): request-to-hire, unpublish, and
 * approve/decline a hire request. Each surfaces its server-action error inline.
 */

import { useFormState, useFormStatus } from "react-dom";
import {
  approveHireAction,
  declineHireAction,
  requestHireAction,
  unpublishListingAction,
  type MarketplaceActionState,
} from "@/modules/marketplace/actions";
import { buttonClasses, FieldError } from "@/components/ui";

function Submit({ label, busy, variant = "primary" }: { label: string; busy: string; variant?: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses(variant)}>
      {pending ? busy : label}
    </button>
  );
}

export function HireButton({ listingId }: { listingId: string }) {
  const [state, action] = useFormState(requestHireAction, {} as MarketplaceActionState);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="listingId" value={listingId} />
      <Submit label="Request to hire" busy="Sending…" />
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}

export function UnpublishButton({ listingId }: { listingId: string }) {
  const [state, action] = useFormState(unpublishListingAction, {} as MarketplaceActionState);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="listingId" value={listingId} />
      <Submit label="Unpublish" busy="Removing…" variant="secondary" />
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}

export function HireDecision({ hireId }: { hireId: string }) {
  const [approveState, approve] = useFormState(approveHireAction, {} as MarketplaceActionState);
  const [declineState, decline] = useFormState(declineHireAction, {} as MarketplaceActionState);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <form action={decline}>
          <input type="hidden" name="hireId" value={hireId} />
          <button type="submit" className={buttonClasses("secondary", "sm")}>
            Decline
          </button>
        </form>
        <form action={approve}>
          <input type="hidden" name="hireId" value={hireId} />
          <button type="submit" className={buttonClasses("primary", "sm")}>
            Approve &amp; clone
          </button>
        </form>
      </div>
      {approveState?.error ? <FieldError>{approveState.error}</FieldError> : null}
      {declineState?.error ? <FieldError>{declineState.error}</FieldError> : null}
    </div>
  );
}
