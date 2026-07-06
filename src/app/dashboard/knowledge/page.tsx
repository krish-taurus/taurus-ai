import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { getVaultOverview } from "@/modules/knowledge/service";
import { KnowledgeSourceCard } from "@/components/knowledge/knowledge-source-card";
import { buttonClasses, EmptyState, PageHeader, StatCard } from "@/components/ui";

export default async function KnowledgeVaultPage() {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "knowledge.view")) {
    redirect("/dashboard");
  }

  const store = getStore();
  const overview = await getVaultOverview(store, organization.id);
  const sources = (await store.listKnowledgeSources(organization.id)).filter(
    (s) => s.status !== "archived",
  );
  const canManage = hasPermission(membership.role, "knowledge.manage");

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge Vault"
        title="Company knowledge"
        description="A secure library of documents, notes, and websites your AI Employees can use."
        action={
          canManage && sources.length > 0 ? (
            <Link href="/dashboard/knowledge/new" className={buttonClasses("primary")}>
              Add Knowledge
            </Link>
          ) : undefined
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Sources" value={overview.total} />
        <StatCard label="Ready" value={overview.ready} />
        <StatCard label="Assigned" value={overview.assigned} />
      </div>

      {sources.length === 0 ? (
        <EmptyState
          title="Your Knowledge Vault is empty."
          description={
            canManage
              ? "Add a document, note, or website so your AI Employees can work with trusted company knowledge."
              : "Ask an organization admin to add company knowledge."
          }
          action={
            canManage ? (
              <Link href="/dashboard/knowledge/new" className={buttonClasses("primary", "lg")}>
                Add Knowledge
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => (
            <KnowledgeSourceCard key={source.id} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}
