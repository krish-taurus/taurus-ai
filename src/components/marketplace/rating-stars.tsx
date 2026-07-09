/**
 * Marketplace rating display (Sprint 032). Pure, monochrome — filled vs. empty
 * stars read without color.
 */

export function RatingStars({ value, className }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span aria-hidden className={className}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= filled ? "text-taurus-text" : "text-taurus-strong"}>
          {n <= filled ? "★" : "☆"}
        </span>
      ))}
    </span>
  );
}

/** A compact "★★★★☆ 4.2 (7)" summary; shows nothing rated yet when count is 0. */
export function RatingSummary({
  avg,
  count,
  className,
}: {
  avg: number | null;
  count: number;
  className?: string;
}) {
  if (count === 0 || avg === null) {
    return <span className={`text-xs text-taurus-faint ${className ?? ""}`}>No reviews yet</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${className ?? ""}`}>
      <RatingStars value={avg} />
      <span className="font-medium text-taurus-text">{avg.toFixed(1)}</span>
      <span className="text-taurus-faint">
        ({count} {count === 1 ? "review" : "reviews"})
      </span>
    </span>
  );
}
