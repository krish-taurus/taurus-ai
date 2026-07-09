import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { getVaultOverview, listKnowledgeVaultSummaries } from "@/modules/knowledge/service";
import { KnowledgeSourceCard } from "@/components/knowledge/knowledge-source-card";
import { NewVaultButton, VaultActions } from "@/components/knowledge/vault-controls";
import { buttonClasses, EmptyState, PageHeader, StatCard } from "@/components/ui";

export default async function KnowledgeVaultPage() {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "knowledge.view")) {
    redirect("/dashboard");
  }

  const store = getStore();
  const overview = await getVaultOverview(store, organization.id);
  const [summaries, sources] = await Promise.all([
    listKnowledgeVaultSummaries(store, organization.id),
    store
      .listKnowledgeSources(organization.id)
      .then((all) => all.filter((s) => s.status !== "archived")),
  ]);
  const canManage = hasPermission(membership.role, "knowledge.manage");

  // Group sources by vault. Any source without a (known) vault falls into "Unfiled".
  const knownVaultIds = new Set(summaries.map((s) => s.vault.id));
  const byVault = new Map(summaries.map((s) => [s.vault.id, [] as typeof sources]));
  const unfiled: typeof sources = [];
  for (const source of sources) {
    if (source.vaultId && knownVaultIds.has(source.vaultId)) {
      byVault.get(source.vaultId)!.push(source);
    } else {
      unfiled.push(source);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Knowledge Vault"
        title="Company knowledge"
        description="Organize documents, notes, websites, and data sources into vaults your AI Employees can use."
        action={
          canManage && sources.length > 0 ? (
            <Link href="/dashboard/knowledge/new" className={buttonClasses("primary")}>
              Add Knowledge
            </Link>
          ) : undefined
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Vaults" value={summaries.length} />
        <StatCard label="Sources" value={overview.total} />
        <StatCard label="Ready" value={overview.ready} />
        <StatCard label="Assigned" value={overview.assigned} />
      </div>

      {canManage ? (
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-sm text-taurus-sub">
            Group related knowledge into vaults, then assign a whole vault to an AI Employee.
          </p>
          <NewVaultButton />
        </div>
      ) : null}

      {sources.length === 0 && summaries.length === 0 ? (
        <EmptyState
          title="Your Knowledge Vault is empty."
          description={
            canManage
              ? "Create a vault and add a document, note, website, or data source so your AI Employees can work with trusted company knowledge."
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
        <div className="space-y-10">
          {summaries.map((summary) => {
            const vaultSources = byVault.get(summary.vault.id) ?? [];
            return (
              <section key={summary.vault.id}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-taurus-line pb-2">
                  <div>
                    <h2 className="text-base font-semibold text-taurus-text">
                      {summary.vault.name}
                      {summary.vault.isDefault ? (
                        <span className="ml-2 text-xs font-normal text-taurus-faint">Default</span>
                      ) : null}
                    </h2>
                    <p className="text-xs text-taurus-faint">
                      {summary.sourceCount} {summary.sourceCount === 1 ? "source" : "sources"} ·{" "}
                      {summary.readyCount} ready
                    </p>
                  </div>
                  <VaultActions
                    vaultId={summary.vault.id}
                    vaultName={summary.vault.name}
                    isDefault={summary.vault.isDefault}
                    canManage={canManage}
                  />
                </div>
                {vaultSources.length === 0 ? (
                  <p className="text-sm text-taurus-faint">
                    No sources yet.{" "}
                    {canManage ? (
                      <Link
                        href={`/dashboard/knowledge/new?vault=${summary.vault.id}`}
                        className="font-medium text-taurus-sub hover:text-taurus-text"
                      >
                        Add one →
                      </Link>
                    ) : null}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {vaultSources.map((source) => (
                      <KnowledgeSourceCard key={source.id} source={source} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {unfiled.length > 0 ? (
            <section>
              <div className="mb-4 border-b border-taurus-line pb-2">
                <h2 className="text-base font-semibold text-taurus-text">Unfiled</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {unfiled.map((source) => (
                  <KnowledgeSourceCard key={source.id} source={source} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
