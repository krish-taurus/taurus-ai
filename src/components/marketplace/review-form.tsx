"use client";

/**
 * Leave / update a rating + review for an AI Employee you've hired (Sprint 032).
 */

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitReviewAction, type MarketplaceActionState } from "@/modules/marketplace/actions";
import { buttonClasses, FieldError, Textarea } from "@/components/ui";

function SubmitButton({ existing }: { existing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary")}>
      {pending ? "Saving…" : existing ? "Update review" : "Submit review"}
    </button>
  );
}

export function ReviewForm({
  listingId,
  defaultRating,
  defaultComment,
}: {
  listingId: string;
  defaultRating?: number;
  defaultComment?: string;
}) {
  const [state, action] = useFormState(submitReviewAction, {} as MarketplaceActionState);
  const [rating, setRating] = useState(defaultRating ?? 0);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="rating" value={rating} />
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            aria-checked={rating === n}
            role="radio"
            onClick={() => setRating(n)}
            className={`text-2xl leading-none ${n <= rating ? "text-taurus-text" : "text-taurus-strong hover:text-taurus-sub"}`}
          >
            {n <= rating ? "★" : "☆"}
          </button>
        ))}
      </div>
      <Textarea
        name="comment"
        rows={3}
        defaultValue={defaultComment}
        placeholder="How did this AI Employee perform for your team? (optional)"
      />
      {state?.error ? <FieldError>{state.error}</FieldError> : null}
      <SubmitButton existing={!!defaultRating} />
    </form>
  );
}
