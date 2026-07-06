/** Pricing disclaimer shown wherever cost estimates appear (Prompt 006B). */
import { PRICING_DISCLAIMER } from "@/modules/model-gateway/pricing";

export function PricingDisclaimer() {
  return (
    <p className="rounded-lg border border-taurus-line bg-taurus-muted px-3 py-2 text-xs text-taurus-faint">
      <span aria-hidden className="mr-1 font-semibold">
        ⚠
      </span>
      {PRICING_DISCLAIMER}
    </p>
  );
}
