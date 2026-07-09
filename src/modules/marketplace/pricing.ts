/**
 * Marketplace pricing helpers (Sprint 034) — pure, safe for client + server.
 *
 * Amounts are stored in MINOR units (cents, paise) to avoid float drift. These
 * helpers convert to/from the major unit for display and input, and format a
 * price with its currency symbol.
 */

import type { MarketplacePricingModel } from "@/lib/db/types";

export interface SupportedCurrency {
  code: string; // ISO 4217 lower, matches what we store
  label: string;
  symbol: string;
  /** Minor units per major unit (100 for USD/EUR/INR/GBP). */
  minorPerMajor: number;
}

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  { code: "usd", label: "USD", symbol: "$", minorPerMajor: 100 },
  { code: "eur", label: "EUR", symbol: "€", minorPerMajor: 100 },
  { code: "gbp", label: "GBP", symbol: "£", minorPerMajor: 100 },
  { code: "inr", label: "INR", symbol: "₹", minorPerMajor: 100 },
];

export function isSupportedCurrency(code: string): boolean {
  return SUPPORTED_CURRENCIES.some((c) => c.code === code.toLowerCase());
}

function currencyOf(code: string): SupportedCurrency {
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code === code.toLowerCase()) ?? {
      code: code.toLowerCase(),
      label: code.toUpperCase(),
      symbol: "",
      minorPerMajor: 100,
    }
  );
}

/** Convert a major-unit input (e.g. "12.50") to minor units (1250). Null if invalid. */
export function majorToMinor(input: string | number, currency: string): number | null {
  const c = currencyOf(currency);
  const value = typeof input === "number" ? input : Number(String(input).replace(/,/g, "").trim());
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * c.minorPerMajor);
}

/** Format a minor-unit amount for display, e.g. formatMoney(1250, "usd") => "$12.50". */
export function formatMoney(amountMinor: number, currency: string): string {
  const c = currencyOf(currency);
  const major = amountMinor / c.minorPerMajor;
  const digits = c.minorPerMajor === 1 ? 0 : 2;
  return `${c.symbol}${major.toFixed(digits)} ${c.label}`;
}

/** True when a listing is actually charging (priced one-time with a positive amount). */
export function isPricedListing(listing: {
  priceModel: MarketplacePricingModel;
  priceAmount: number | null;
}): boolean {
  return listing.priceModel === "one_time" && (listing.priceAmount ?? 0) > 0;
}
