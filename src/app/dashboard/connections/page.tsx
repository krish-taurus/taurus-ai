import Link from "next/link";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import {
  CONNECTION_TYPE_ORDER,
  filterConnections,
  type ConnectionFilter,
} from "@/modules/channels/connections";
import type { ChannelStatus, ChannelType } from "@/lib/db/types";
import { ConnectionCard } from "@/components/connections/connection-card";
import { ConnectionCatalog } from "@/components/connections/connection-catalog";
import { ConnectionsFilters } from "@/components/connections/connections-filters";
import { buttonClasses, EmptyState, PageHeader, SectionHeader, StatCard } from "@/components/ui";

const KNOWN_TYPES = new Set<string>(CONNECTION_TYPE_ORDER);
const KNOWN_STATUSES = new Set<string>(["active", "paused", "draft", "archived"]);

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: { employee?: string; type?: string; status?: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "channel.view")) {
    redirect("/dashboard");
  }
  const canManage = hasPermission(membership.role, "channel.manage");

  const store = getStore();
  const [employees, channels] = await Promise.all([
    store.listEmployees(organization.id),
    store.listEmployeeChannelsForOrganization(organization.id),
  ]);

  const employeeName = new Map(employees.map((e) => [e.id, e.name]));

  // Validate filters from the URL against known values.
  const filter: ConnectionFilter = {
    employeeId:
      searchParams.employee && employeeName.has(searchParams.employee)
        ? searchParams.employee
        : null,
    type:
      searchParams.type && KNOWN_TYPES.has(searchParams.type)
        ? (searchParams.type as ChannelType)
        : null,
    status:
      searchParams.status && KNOWN_STATUSES.has(searchParams.status)
        ? (searchParams.status as ChannelStatus)
        : null,
  };
  const filtered = filterConnections(channels, filter);
  const hasFilters = Boolean(filter.employeeId || filter.type || filter.status);

  const activeCount = channels.filter((c) => c.status === "active").length;
  const hasEmployees = employees.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Deployment"
        title="Connections"
        description="See and manage every place your AI Employees are deployed — websites, messaging, email, and calls."
        action={
          canManage && hasEmployees ? (
            <Link href="/dashboard/connections/new" className={buttonClasses("primary")}>
              New connection
            </Link>
          ) : undefined
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Connections" value={channels.length} />
        <StatCard label="Active" value={activeCount} />
        <StatCard label="AI Employees" value={employees.length} />
      </div>

      <section>
        <SectionHeader title="Your connections" />

        {channels.length === 0 ? (
          <EmptyState
            title="No connections configured yet."
            description={
              canManage
                ? "Connect an AI Employee to your website, messaging, email, or phone."
                : "Ask an organization admin to connect an AI Employee to a channel."
            }
            action={
              canManage && hasEmployees ? (
                <Link href="/dashboard/connections/new" className={buttonClasses("primary", "lg")}>
                  New connection
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="mb-5">
              <ConnectionsFilters
                employees={employees.map((e) => ({ id: e.id, name: e.name }))}
                types={CONNECTION_TYPE_ORDER}
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title="No connections match these filters."
                description="Try clearing a filter to see more."
                action={
                  hasFilters ? (
                    <Link href="/dashboard/connections" className={buttonClasses("secondary")}>
                      Clear filters
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((channel) => (
                  <ConnectionCard
                    key={channel.id}
                    channel={channel}
                    employeeName={employeeName.get(channel.employeeId) ?? "Unknown AI Employee"}
                    canManage={canManage}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="mt-12">
        <SectionHeader title="All connection types" />
        <ConnectionCatalog canManage={canManage} />
      </section>
    </div>
  );
}
