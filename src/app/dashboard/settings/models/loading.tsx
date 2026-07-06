import { Skeleton } from "@/components/ui";

export default function ModelHubLoading() {
  return (
    <div className="animate-fade-in">
      <Skeleton className="mb-6 h-9 w-56" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
