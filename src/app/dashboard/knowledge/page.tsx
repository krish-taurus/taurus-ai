import { PageHeader } from "@/components/page-header";

export default function KnowledgeVaultPage() {
  return (
    <div>
      <PageHeader
        title="Knowledge Vault"
        description="Approved company knowledge your AI employees are allowed to use."
      />

      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <p className="mx-auto max-w-md text-base text-slate-700">
          Your Knowledge Vault is empty. Upload company documents here so your AI employees can work
          with approved knowledge.
        </p>
      </div>
    </div>
  );
}
