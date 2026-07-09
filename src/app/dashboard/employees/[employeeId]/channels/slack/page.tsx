import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { getClientEnv } from "@/lib/env/env";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { isSlackConfigured } from "@/modules/channels/slack/oauth";
import { CHANNEL_STATUS_LABELS } from "@/modules/channels/metadata";
import { WebhookUrlPanel } from "@/components/channels/messaging/webhook-url-panel";
import { buttonClasses, Badge, Card, Notice, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SlackSetupPage({
  params,
  searchParams,
}: {
  params: { employeeId: string };
  searchParams?: { connected?: string; error?: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "channel.view")) redirect("/dashboard");

  const store = getStore();
  const employee = await store.getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  const canManage = hasPermission(membership.role, "messaging_channel.manage");
  const configured = isSlackConfigured();
  const channels = await store.listEmployeeChannelsForEmployee(organization.id, employee.id);
  const channel = channels.find((c) => c.channelType === "slack" && c.status !== "archived") ?? null;
  const teamName = typeof channel?.providerConfig?.team_name === "string"
    ? (channel.providerConfig.team_name as string)
    : null;

  const appUrl = getClientEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const requestUrl = `${appUrl}/api/webhooks/slack`;

  const errorMessage: Record<string, string> = {
    unavailable: "Slack isn't configured on this server yet. Ask your admin to add the Slack app keys.",
    denied: "The Slack connection was cancelled or could not be verified. Please try again.",
    failed: "Slack sign-in could not be completed. Please try again.",
    forbidden: "You do not have permission to connect Slack for this organization.",
  };

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
        title="Slack channel"
        description={`Bring ${employee.name} into your Slack workspace.`}
      />

      {searchParams?.error ? (
        <div className="mb-5">
          <Notice>{errorMessage[searchParams.error] ?? "Something went wrong. Please try again."}</Notice>
        </div>
      ) : null}
      {searchParams?.connected ? (
        <Card className="mb-5 border-taurus-line bg-taurus-muted p-4 text-sm text-taurus-text">
          Slack connected{teamName ? ` to ${teamName}` : ""}. Finish by pointing your Slack app&apos;s
          Event Subscriptions at the Request URL below, then message the app in Slack.
        </Card>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={channel?.status === "active" ? "solid" : "outline"}>
          {channel ? CHANNEL_STATUS_LABELS[channel.status] : "Not connected"}
        </Badge>
        {teamName ? <Badge tone="soft">{teamName}</Badge> : null}
        <Badge tone="outline">{configured ? "App configured" : "Not configured on server"}</Badge>
      </div>

      {!configured ? (
        <Notice>
          Slack is not configured on this server. An admin needs to create a Slack app and set
          SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_SIGNING_SECRET to enable one-tap connect.
        </Notice>
      ) : (
        <div className="space-y-5">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-taurus-text">
              {channel ? "Reconnect Slack" : "Connect Slack"}
            </h3>
            <p className="mt-1 text-sm text-taurus-sub">
              One tap: authorize the app in your workspace and {employee.name} starts replying to
              messages and mentions. No tokens to copy.
            </p>
            {canManage ? (
              <a
                href={`/api/channels/slack/install?employeeId=${employee.id}`}
                className={`${buttonClasses("primary")} mt-4 inline-flex`}
              >
                {channel ? "Reconnect to Slack" : "Add to Slack"}
              </a>
            ) : (
              <p className="mt-3 text-xs text-taurus-faint">
                Ask an organization admin to connect Slack.
              </p>
            )}
          </Card>

          {channel && canManage ? (
            <WebhookUrlPanel
              webhookUrl={requestUrl}
              verificationNote="Set this as the Request URL under your Slack app's Event Subscriptions. Slack sends a one-time verification challenge, then message events."
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
