/** Loading skeleton for the AI Employees list (Prompt 003). */
export default function EmployeesLoading() {
  return (
    <div>
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-taurus-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-lg border border-taurus-line bg-taurus-surface"
          />
        ))}
      </div>
    </div>
  );
}
