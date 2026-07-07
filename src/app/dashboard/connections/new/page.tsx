import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { CONFIGURABLE_CONNECTION_TYPES, isConfigurableType } from "@/modules/channels/connections";
import type { ChannelType } from "@/lib/db/types";
import { NewConnectionForm } from "@/components/connections/new-connection-form";
import { buttonClasses, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function NewConnectionPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();
  // Managing connections is owner/admin/builder (existing channel.manage).
  if (!hasPermission(membership.role, "channel.manage")) {
    redirect("/dashboard/connections");
  }

  const store = getStore();
  const employees = await store.listEmployees(organization.id);

  const defaultType =
    searchParams.type && isConfigurableType(searchParams.type as ChannelType)
      ? (searchParams.type as ChannelType)
      : undefined;

  return (
    <div className="mx-auto max-w-lg">
      <p className="mb-4 text-sm">
        <Link
          href="/dashboard/connections"
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← Connections
        </Link>
      </p>

      <PageHeader
        eyebrow="Connections"
        title="New connection"
        description="Choose an AI Employee and a connection type. You'll finish setup on the AI Employee's connection page."
      />

      {employees.length === 0 ? (
        <EmptyState
          title="Hire an AI Employee first."
          description="Connections attach to an AI Employee, so you'll need at least one."
          action={
            hasPermission(membership.role, "employee.create") ? (
              <Link href="/dashboard/hire" className={buttonClasses("primary", "lg")}>
                Hire AI Employee
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="p-6">
          <NewConnectionForm
            employees={employees.map((e) => ({ id: e.id, name: e.name }))}
            types={CONFIGURABLE_CONNECTION_TYPES}
            defaultType={defaultType}
          />
        </Card>
      )}
    </div>
  );
}
