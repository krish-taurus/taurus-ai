import { EmptyState, PageHeader } from "@/components/ui";

export default function AuditPage() {
  return (
    <div>
      <PageHeader
        title="Audit"
        description="A record of important actions taken across your organization."
      />
      <EmptyState
        title="No audit events yet."
        description="Major actions in your organization will be recorded here."
      />
    </div>
  );
}
