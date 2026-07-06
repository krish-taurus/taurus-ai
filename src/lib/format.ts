/**
 * Small formatting helpers shared across the UI.
 */

/** Format an ISO timestamp as a short, human-readable date (e.g. "Jul 6, 2026"). */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
