import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { OrgModelSettingsForm } from "@/components/model-hub/org-model-settings-form";
import { PageHeader } from "@/components/ui";

export default async function ConfigureModelHubPage() {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "model_hub.manage")) {
    redirect("/dashboard/settings/models");
  }

  const store = getStore();
  const [settings, models, providers] = await Promise.all([
    store.getOrganizationModelSettings(organization.id),
    store.listAiModels(),
    store.listModelProviders(),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Model Hub"
        title="Configure Model Hub"
        description="Set the default Employee Brain, allowed providers, and budget for your organization."
      />
      <OrgModelSettingsForm settings={settings} models={models} providers={providers} />
    </div>
  );
}
