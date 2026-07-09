"use client";

/**
 * Owner control to set (or clear) a listing's one-time hire price (Sprint 034).
 * A free listing keeps the request→approve flow; a priced listing becomes
 * buy-now. Amounts are entered in the major unit and converted server-side.
 */

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { setListingPriceAction, type MarketplaceActionState } from "@/modules/marketplace/actions";
import { SUPPORTED_CURRENCIES } from "@/modules/marketplace/pricing";
import type { MarketplacePricingModel } from "@/lib/db/types";
import { buttonClasses, FieldError } from "@/components/ui";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary", "sm")}>
      {pending ? "Saving…" : "Save price"}
    </button>
  );
}

export function PriceForm({
  listingId,
  priceModel,
  priceMajor,
  priceCurrency,
}: {
  listingId: string;
  priceModel: MarketplacePricingModel;
  priceMajor: string;
  priceCurrency: string | null;
}) {
  const [state, action] = useFormState(setListingPriceAction, {} as MarketplaceActionState);
  const [paid, setPaid] = useState(priceModel === "one_time");

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="priceModel" value={paid ? "one_time" : "free"} />

      <label className="flex items-center gap-2 text-sm text-taurus-text">
        <input
          type="checkbox"
          checked={paid}
          onChange={(e) => setPaid(e.target.checked)}
          className="h-4 w-4"
        />
        Charge a one-time fee to hire this AI Employee
      </label>

      {paid ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-taurus-faint">Amount</label>
            <input
              name="priceAmount"
              type="number"
              min="0"
              step="0.01"
              defaultValue={priceMajor}
              placeholder="49.00"
              className="w-32 rounded-lg border border-taurus-line bg-taurus-elevated px-3 py-1.5 text-sm text-taurus-text"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-taurus-faint">Currency</label>
            <select
              name="priceCurrency"
              defaultValue={priceCurrency ?? "usd"}
              className="rounded-lg border border-taurus-line bg-taurus-elevated px-3 py-1.5 text-sm text-taurus-text"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} ({c.symbol})
                </option>
              ))}
            </select>
          </div>
          <Save />
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-sm text-taurus-sub">
            Free — organizations request to hire and you approve each one.
          </p>
          <Save />
        </div>
      )}

      {state?.error ? <FieldError>{state.error}</FieldError> : null}
    </form>
  );
}
