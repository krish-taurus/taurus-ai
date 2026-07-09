import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { getClientEnv } from "@/lib/env/env";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { CHANNEL_STATUS_LABELS } from "@/modules/channels/metadata";
import { TeamsConnectForm } from "@/components/channels/teams/teams-connect-form";
import { WebhookUrlPanel } from "@/components/channels/messaging/webhook-url-panel";
import { Badge, Card, EmptyState, Notice, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TeamsSetupPage({
  params,
  searchParams,
}: {
  params: { employeeId: string };
  searchParams?: { connected?: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "channel.view")) redirect("/dashboard");

  const store = getStore();
  const employee = await store.getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  const canManage = hasPermission(membership.role, "messaging_channel.manage");
  const channels = await store.listEmployeeChannelsForEmployee(organization.id, employee.id);
  const channel =
    channels.find((c) => c.channelType === "microsoft_teams" && c.status !== "archived") ?? null;
  const tenantName = typeof channel?.providerConfig?.tenant_name === "string"
    ? (channel.providerConfig.tenant_name as string)
    : null;

  const appUrl = getClientEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const messagingEndpoint = `${appUrl}/api/webhooks/teams`;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-4 text-sm">
        <Link
          href={`/dashboard/employees/${employee.id}/channels`}
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← Channels
        </Link>
      </p>

      <PageHeader
        eyebrow="Workplace"
        title="Microsoft Teams"
        description={`Bring ${employee.name} into Microsoft Teams.`}
      />

      {searchParams?.connected ? (
        <Card className="mb-5 border-taurus-line bg-taurus-muted p-4 text-sm text-taurus-text">
          Teams connected{tenantName ? ` for ${tenantName}` : ""}. Set the messaging endpoint below on
          your Azure app, then message the app in Teams.
        </Card>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={channel?.status === "active" ? "solid" : "outline"}>
          {channel ? CHANNEL_STATUS_LABELS[channel.status] : "Not connected"}
        </Badge>
        {tenantName ? <Badge tone="soft">{tenantName}</Badge> : null}
      </div>

      <Notice>
        Teams needs a Microsoft app registration (with a messaging endpoint) and a sideloaded Teams
        app manifest. Create it in Azure, set its messaging endpoint to the URL below, then enter its
        App ID + client secret + your tenant ID here.
      </Notice>

      <div className="mt-5 space-y-5">
        {canManage ? (
          <Card className="p-6">
            <h3 className="mb-4 text-sm font-semibold text-taurus-text">
              {channel ? "Reconnect Teams" : "Connect Teams"}
            </h3>
            <TeamsConnectForm
              employeeId={employee.id}
              defaults={{
                appId: typeof channel?.providerConfig?.app_id === "string"
                  ? (channel.providerConfig.app_id as string)
                  : "",
                tenantId: typeof channel?.providerConfig?.tenant_id === "string"
                  ? (channel.providerConfig.tenant_id as string)
                  : "",
                tenantName,
              }}
            />
          </Card>
        ) : (
          <EmptyState
            title="Teams is not connected yet."
            description="Ask an organization admin to connect Microsoft Teams."
          />
        )}

        {canManage ? (
          <WebhookUrlPanel
            webhookUrl={messagingEndpoint}
            verificationNote="Set this as your Azure app's Messaging endpoint. Microsoft signs each request; Taurus verifies it."
          />
        ) : null}
      </div>
    </div>
  );
}
