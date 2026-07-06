/** Loading skeleton for the Employee DNA page (Prompt 005). */
export default function EmployeeDnaLoading() {
  return (
    <div className="max-w-3xl">
      <div className="mb-4 h-4 w-40 animate-pulse rounded bg-slate-200" />
      <div className="h-28 animate-pulse rounded-lg border border-slate-200 bg-white" />
      <div className="mt-6 h-40 animate-pulse rounded-lg border border-slate-200 bg-white" />
      <div className="mt-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-lg border border-slate-200 bg-white" />
        ))}
      </div>
    </div>
  );
}
