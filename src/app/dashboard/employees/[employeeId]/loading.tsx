/** Loading skeleton for an AI Employee profile (Prompt 003). */
export default function EmployeeDetailLoading() {
  return (
    <div className="max-w-3xl">
      <div className="mb-4 h-4 w-32 animate-pulse rounded bg-taurus-muted" />
      <div className="h-52 animate-pulse rounded-lg border border-taurus-line bg-taurus-surface" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-taurus-line bg-taurus-surface"
          />
        ))}
      </div>
    </div>
  );
}
