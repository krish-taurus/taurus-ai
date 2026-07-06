import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { CreateKnowledgeForms } from "@/components/knowledge/create-knowledge-forms";
import { Card, PageHeader } from "@/components/ui";

export default async function NewKnowledgePage() {
  const { membership } = await requireCurrentOrganization();
  // Least privilege: only roles that can manage the vault may add knowledge.
  if (!hasPermission(membership.role, "knowledge.manage")) {
    redirect("/dashboard/knowledge");
  }

  return (
    <div className="max-w-2xl">
      <p className="mb-4 text-sm">
        <Link
          href="/dashboard/knowledge"
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← Back to Knowledge Vault
        </Link>
      </p>

      <PageHeader
        eyebrow="Knowledge Vault"
        title="Add Knowledge"
        description="Add a note, upload a document, or save a website for your AI Employees."
      />

      <Card className="p-6 sm:p-8">
        <CreateKnowledgeForms />
      </Card>
    </div>
  );
}
