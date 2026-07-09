import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { listKnowledgeVaults } from "@/modules/knowledge/service";
import { EditKnowledgeForm } from "@/components/knowledge/edit-knowledge-form";
import { Card, PageHeader } from "@/components/ui";

export default async function EditKnowledgeSourcePage({
  params,
}: {
  params: { sourceId: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "knowledge.manage")) {
    redirect(`/dashboard/knowledge/${params.sourceId}`);
  }

  const store = getStore();
  const source = await store.getKnowledgeSource(organization.id, params.sourceId);
  if (!source) notFound();
  const vaults = (await listKnowledgeVaults(store, organization.id)).map((v) => ({
    id: v.id,
    name: v.name,
  }));

  return (
    <div className="max-w-2xl">
      <p className="mb-4 text-sm">
        <Link
          href={`/dashboard/knowledge/${source.id}`}
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← Back to source
        </Link>
      </p>

      <PageHeader
        title={`Edit ${source.name}`}
        description="Update this knowledge source's details."
      />

      <Card className="p-6">
        <EditKnowledgeForm source={source} vaults={vaults} />
      </Card>
    </div>
  );
}
