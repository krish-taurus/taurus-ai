import { Skeleton } from "@/components/ui";

/** Loading skeleton for the Audit trail. */
export default function AuditLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-40" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </div>
  );
}
