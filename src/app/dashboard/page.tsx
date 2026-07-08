import Link from "next/link";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { EmployeeCard } from "@/components/employees/employee-card";
import { getModel } from "@/modules/model-gateway/catalog";
import { brainModeForRoutingMode, ROUTING_MODE_LABELS } from "@/modules/model-gateway/metadata";
import { formatUsd } from "@/modules/model-gateway/pricing";
import { buttonClasses, EmptyState, PageHeader, SectionHeader, StatCard } from "@/components/ui";
import { getOnboardingState, recordOnboardingCompletion } from "@/modules/onboarding/service";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";

export default async function DashboardPage() {
  const { user, organization, membership } = await requireCurrentOrganization();
  const store = getStore();

  // First-run activation checklist — derived from real data, dismissible/resumable.
  const onboardingCtx = {
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
  };
  const onboarding = await getOnboardingState(store, onboardingCtx);
  if (onboarding.complete && !onboarding.completionRecorded) {
    await recordOnboardingCompletion(store, onboardingCtx);
  }
  const employees = await store.listEmployees(organization.id);
  const canHire = hasPermission(membership.role, "employee.create");
  const preview = employees.slice(0, 3);

  const activeCount = employees.filter((e) => e.status === "active").length;
  const draftCount = employees.filter((e) => e.status === "draft").length;

  const knowledge = await store.getKnowledgeVaultOverview(organization.id);
  const canViewKnowledge = hasPermission(membership.role, "knowledge.view");
  const canManageKnowledge = hasPermission(membership.role, "knowledge.manage");

  const modelHub = await store.getModelHubOverview(organization.id);
  const canViewModelHub = hasPermission(membership.role, "model_hub.view");

  const canViewConnections = hasPermission(membership.role, "channel.view");
  const connections = canViewConnections
    ? await store.listEmployeeChannelsForOrganization(organization.id)
    : [];
  const activeConnections = connections.filter((c) => c.status === "active").length;
  const canManageConnections = hasPermission(membership.role, "channel.manage");
  const defaultBrainLabel = modelHub.defaultModelId
    ? (getModel(modelHub.defaultModelId)?.displayName ??
      brainModeForRoutingMode(modelHub.routingMode)?.label ??
      ROUTING_MODE_LABELS[modelHub.routingMode])
    : (brainModeForRoutingMode(modelHub.routingMode)?.label ??
      ROUTING_MODE_LABELS[modelHub.routingMode]);

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title={organization.name}
        description="Your AI workforce at a glance."
        action={
          canHire ? (
            <Link href="/dashboard/hire" className={buttonClasses("primary")}>
              Hire AI Employee
            </Link>
          ) : undefined
        }
      />

      <OnboardingChecklist state={onboarding} />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="AI Employees" value={employees.length} />
        <StatCard label="Active" value={activeCount} />
        <StatCard label="In draft" value={draftCount} />
      </div>

      <section>
        <SectionHeader
          title="AI Employees"
          action={
            employees.length > 0 ? (
              <Link
                href="/dashboard/employees"
                className="text-sm font-medium text-taurus-sub hover:text-taurus-text"
              >
                View all ({employees.length})
              </Link>
            ) : undefined
          }
        />

        {employees.length === 0 ? (
          <EmptyState
            title="You have not hired your first AI Employee yet."
            description={
              canHire ? undefined : "Ask an organization admin to hire your first AI Employee."
            }
            action={
              canHire ? (
                <Link href="/dashboard/hire" className={buttonClasses("primary", "lg")}>
                  Hire AI Employee
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {preview.map((employee) => (
              <EmployeeCard key={employee.id} employee={employee} />
            ))}
          </div>
        )}
      </section>

      {canViewKnowledge ? (
        <section className="mt-10">
          <SectionHeader
            title="Knowledge Vault"
            action={
              knowledge.total > 0 ? (
                <Link
                  href="/dashboard/knowledge"
                  className="text-sm font-medium text-taurus-sub hover:text-taurus-text"
                >
                  Open Knowledge Vault
                </Link>
              ) : undefined
            }
          />

          {knowledge.total === 0 ? (
            <EmptyState
              title="Your Knowledge Vault is empty."
              description={
                canManageKnowledge
                  ? "Add company knowledge your AI Employees can use."
                  : "Ask an organization admin to add company knowledge."
              }
              action={
                canManageKnowledge ? (
                  <Link href="/dashboard/knowledge/new" className={buttonClasses("primary", "lg")}>
                    Add Knowledge
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Sources" value={knowledge.total} />
              <StatCard label="Ready" value={knowledge.ready} />
              <StatCard label="Assigned" value={knowledge.assigned} />
            </div>
          )}
        </section>
      ) : null}

      {canViewModelHub ? (
        <section className="mt-10">
          <SectionHeader
            title="Model Hub"
            action={
              <Link
                href="/dashboard/settings/models"
                className="text-sm font-medium text-taurus-sub hover:text-taurus-text"
              >
                Open Model Hub
              </Link>
            }
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Default Employee Brain" value={defaultBrainLabel} />
            <StatCard
              label="Monthly budget"
              value={
                modelHub.monthlyBudgetUsd != null ? formatUsd(modelHub.monthlyBudgetUsd) : "Not set"
              }
            />
            <StatCard
              label="Allowed providers"
              value={`${modelHub.allowedProviderCount} of ${modelHub.totalProviders}`}
            />
          </div>
        </section>
      ) : null}

      {canViewConnections ? (
        <section className="mt-10">
          <SectionHeader
            title="Connections"
            action={
              <Link
                href="/dashboard/connections"
                className="text-sm font-medium text-taurus-sub hover:text-taurus-text"
              >
                Open Connections
              </Link>
            }
          />

          {connections.length === 0 ? (
            <EmptyState
              title="No connections configured yet."
              description={
                canManageConnections
                  ? "Deploy an AI Employee to your website, messaging, email, or phone."
                  : "Ask an organization admin to connect an AI Employee to a channel."
              }
              action={
                canManageConnections && employees.length > 0 ? (
                  <Link
                    href="/dashboard/connections/new"
                    className={buttonClasses("primary", "lg")}
                  >
                    New connection
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatCard label="Connections" value={connections.length} />
              <StatCard label="Active" value={activeConnections} />
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
