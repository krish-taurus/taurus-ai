import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { resolveModelForTask } from "@/modules/model-gateway/router";
import { isPlatformKeyAvailable } from "@/modules/model-gateway/credential-resolver";
import { getModel } from "@/modules/model-gateway/catalog";
import { brainModeForRoutingMode, ROUTING_MODE_LABELS } from "@/modules/model-gateway/metadata";
import { formatUsd } from "@/modules/model-gateway/pricing";
import { CostEstimateCard } from "@/components/model-hub/cost-estimate-card";
import { Badge, buttonClasses, Card, PageHeader, StatCard } from "@/components/ui";

export default async function ModelHubOverviewPage() {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "model_hub.view")) {
    redirect("/dashboard");
  }
  const canManage = hasPermission(membership.role, "model_hub.manage");

  const store = getStore();
  const [overview, settings, providers] = await Promise.all([
    store.getModelHubOverview(organization.id),
    store.getOrganizationModelSettings(organization.id),
    store.listModelProviders(),
  ]);

  // A representative model for the cost example: the org default, else whatever
  // the current routing behavior would pick for a typical task.
  const resolved = resolveModelForTask({ orgSettings: settings });
  const exampleModel =
    (settings.defaultModelId ? getModel(settings.defaultModelId) : null) ?? resolved.model;

  const brainMode = brainModeForRoutingMode(settings.routingMode);
  const defaultModel = settings.defaultModelId ? getModel(settings.defaultModelId) : null;
  const defaultBrainLabel = defaultModel
    ? defaultModel.displayName
    : (brainMode?.label ?? ROUTING_MODE_LABELS[settings.routingMode]);

  const providerStatus = await Promise.all(
    providers.map(async (p) => {
      const cred = await store.getProviderCredentialMetadata(organization.id, p.slug);
      return {
        slug: p.slug,
        displayName: p.displayName,
        platform: isPlatformKeyAvailable(p.slug),
        byok: cred?.credentialMode === "bring_your_own_key" && cred.status === "active",
      };
    }),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Model Hub"
        title="Model Hub"
        description="Choose which AI models power your Employees, and keep Taurus provider-agnostic."
        action={
          canManage ? (
            <Link href="/dashboard/settings/models/configure" className={buttonClasses("primary")}>
              Configure Model Hub
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Default Employee Brain" value={defaultBrainLabel} />
        <StatCard
          label="Monthly budget"
          value={
            settings.monthlyBudgetUsd != null ? formatUsd(settings.monthlyBudgetUsd) : "Not set"
          }
        />
        <StatCard
          label="Allowed providers"
          value={`${overview.allowedProviderCount} of ${overview.totalProviders}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {exampleModel ? (
          <CostEstimateCard model={exampleModel} />
        ) : (
          <Card className="p-5 text-sm text-taurus-faint">
            No model is available for the current settings. Configure the Model Hub to choose one.
          </Card>
        )}

        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-taurus-faint">
            Provider status
          </p>
          <ul className="mt-4 space-y-2">
            {providerStatus.map((p) => (
              <li key={p.slug} className="flex items-center justify-between text-sm">
                <span className="text-taurus-sub">{p.displayName}</span>
                <span className="flex items-center gap-1.5">
                  {p.platform ? (
                    <Badge tone="soft">Managed</Badge>
                  ) : (
                    <Badge tone="outline">No managed key</Badge>
                  )}
                  {p.byok ? <Badge tone="solid">Your key</Badge> : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/dashboard/settings/models/catalog" className={buttonClasses("secondary")}>
          View model catalog
        </Link>
        <Link href="/dashboard/settings/models/providers" className={buttonClasses("secondary")}>
          Manage providers
        </Link>
      </div>
    </div>
  );
}
