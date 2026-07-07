import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { resolveModelForTask } from "@/modules/model-gateway/router";
import { BRAIN_MODES } from "@/modules/model-gateway/metadata";
import {
  EmployeeBrainForm,
  type BrainModeModelIds,
} from "@/components/model-hub/employee-brain-form";
import { CostEstimateCard } from "@/components/model-hub/cost-estimate-card";
import { Card, PageHeader } from "@/components/ui";

export default async function EmployeeBrainPage({ params }: { params: { employeeId: string } }) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "model_hub.view")) {
    redirect("/dashboard");
  }

  const store = getStore();
  const employee = await store.getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  const canManage = hasPermission(membership.role, "model_hub.manage");

  const [settings, orgSettings, models, providers] = await Promise.all([
    store.getEmployeeModelSettings(organization.id, employee.id),
    store.getOrganizationModelSettings(organization.id),
    store.listAiModels(),
    store.listModelProviders(),
  ]);

  // The model each selectable mode would use, so the preview can update instantly
  // as the admin changes the selection (before saving). These reflect the catalog
  // choice for each mode; the actual runtime additionally requires a provider key.
  const modeModelIds: BrainModeModelIds = {
    inherit: resolveModelForTask({ orgSettings, employeeSettings: null }).model?.modelId ?? null,
    ...(Object.fromEntries(
      BRAIN_MODES.map((mode) => [
        mode.id,
        resolveModelForTask({ orgSettings, desiredRoutingMode: mode.routingMode }).model?.modelId ??
          null,
      ]),
    ) as Omit<BrainModeModelIds, "inherit">),
  };

  // Read-only view for viewers uses the currently-saved resolution.
  const resolved = resolveModelForTask({ orgSettings, employeeSettings: settings });

  return (
    <div className="max-w-3xl">
      <p className="mb-4 text-sm">
        <Link
          href={`/dashboard/employees/${employee.id}`}
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← {employee.name}
        </Link>
      </p>

      <PageHeader
        eyebrow="Employee Brain"
        title={`${employee.name}'s brain`}
        description="Pick how much this AI Employee should favor cost, quality, speed, or privacy."
      />

      {canManage ? (
        <EmployeeBrainForm
          employeeId={employee.id}
          settings={settings}
          models={models}
          providers={providers}
          modeModelIds={modeModelIds}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="p-6 text-sm text-taurus-sub">
            <p className="font-medium text-taurus-text">
              {resolved.model ? resolved.model.displayName : "No model available"}
            </p>
            <p className="mt-1 text-taurus-faint">{resolved.reason}</p>
            <p className="mt-4 text-taurus-faint">
              Only owners and admins can change the Employee Brain.
            </p>
          </Card>
          <div className="space-y-4">
            {resolved.model ? (
              <CostEstimateCard model={resolved.model} />
            ) : (
              <Card className="p-5 text-sm text-taurus-faint">
                No model is currently available for this Employee. Ask an admin to review the Model
                Hub settings.
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
