import { Skeleton } from "@/components/ui";

/** Loading skeleton for the Knowledge Vault list (Prompt 006). */
export default function KnowledgeLoading() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-56" />
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}
