import { EmptyState, PageHeader } from "@/components/ui";

export default function CollaborationPage() {
  return (
    <div>
      <PageHeader
        title="Collaboration"
        description="Controlled collaboration between your AI Employees."
      />
      <EmptyState
        title="No collaboration requests yet."
        description="Once you have hired AI Employees, they can work together on shared responsibilities here."
      />
    </div>
  );
}
