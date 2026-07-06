import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { ModelCatalogTable } from "@/components/model-hub/model-catalog-table";
import { PricingDisclaimer } from "@/components/model-hub/pricing-disclaimer";
import { buttonClasses, PageHeader } from "@/components/ui";

export default async function ModelCatalogPage() {
  const { membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "model_hub.view")) {
    redirect("/dashboard");
  }

  const store = getStore();
  const [models, providers] = await Promise.all([store.listAiModels(), store.listModelProviders()]);

  return (
    <div>
      <PageHeader
        eyebrow="Model Hub"
        title="Model catalog"
        description="Every provider and model Taurus can use, with capabilities and approximate pricing."
        action={
          <Link href="/dashboard/settings/models" className={buttonClasses("secondary")}>
            Back to Model Hub
          </Link>
        }
      />
      <div className="mb-4">
        <PricingDisclaimer />
      </div>
      <ModelCatalogTable models={models} providers={providers} />
    </div>
  );
}
