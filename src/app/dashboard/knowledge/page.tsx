import { EmptyState, PageHeader } from "@/components/ui";

export default function KnowledgeVaultPage() {
  return (
    <div>
      <PageHeader
        title="Knowledge Vault"
        description="Approved company knowledge your AI Employees are allowed to use."
      />
      <EmptyState
        title="Your Knowledge Vault is empty."
        description="Soon you will upload company documents here so your AI Employees can work with approved knowledge."
      />
    </div>
  );
}
