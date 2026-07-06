import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { getClientEnv } from "@/lib/env/env";
import { formatDate } from "@/lib/format";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import type { ChannelType } from "@/lib/db/types";
import { isChannelEncryptionConfigured } from "@/modules/channels/credentials";
import { getMessagingProvider } from "@/modules/channels/messaging/registry";
import {
  isMessagingChannelType,
  MESSAGING_CHANNEL_LABELS,
  MESSAGING_PROVIDER_LABELS,
  providersForChannelType,
} from "@/modules/channels/messaging/catalog";
import { CHANNEL_STATUS_LABELS } from "@/modules/channels/metadata";
import { CreateMessagingChannelForm } from "@/components/channels/messaging/create-messaging-channel-form";
import { MessagingSettingsForm } from "@/components/channels/messaging/messaging-settings-form";
import { MessagingStatusControls } from "@/components/channels/messaging/messaging-status-controls";
import { ProviderCredentialForm } from "@/components/channels/messaging/provider-credential-form";
import { SimulateForm } from "@/components/channels/messaging/simulate-form";
import { WebhookUrlPanel } from "@/components/channels/messaging/webhook-url-panel";
import { Badge, Card, EmptyState, Notice, PageHeader } from "@/components/ui";

const PROVIDER_TO_SLUG: Record<string, string> = {
  twilio: "twilio",
  meta_whatsapp_cloud: "meta-whatsapp",
  sendgrid: "sendgrid",
  mailgun: "mailgun",
  custom_webhook: "custom",
};

const SENDER_PLACEHOLDER: Record<string, string> = {
  whatsapp: "+15551234567",
  sms: "+15551234567",
  email: "customer@example.com",
};

export default async function MessagingSetupPage({
  params,
}: {
  params: { employeeId: string; type: string };
}) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "channel.view")) redirect("/dashboard");

  const channelType = params.type as ChannelType;
  if (!isMessagingChannelType(channelType)) notFound();

  const store = getStore();
  const employee = await store.getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  const canManage = hasPermission(membership.role, "messaging_channel.manage");
  const canTest = hasPermission(membership.role, "channel.manage");

  const channels = await store.listEmployeeChannelsForEmployee(organization.id, employee.id);
  const channel =
    channels.find((c) => c.channelType === channelType && c.status !== "archived") ?? null;

  const label = MESSAGING_CHANNEL_LABELS[channelType] ?? channelType;
  const appUrl = getClientEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  const backLink = (
    <p className="mb-4 text-sm">
      <Link
        href={`/dashboard/employees/${employee.id}/channels`}
        className="font-medium text-taurus-sub hover:text-taurus-text"
      >
        ← Channels
      </Link>
    </p>
  );

  if (!channel) {
    return (
      <div className="mx-auto max-w-2xl">
        {backLink}
        <PageHeader
          eyebrow="Messaging"
          title={`Configure ${label}`}
          description={`Connect ${employee.name} to ${label}.`}
        />
        {canManage ? (
          <Card className="p-6">
            <CreateMessagingChannelForm
              employeeId={employee.id}
              channelType={channelType}
              employeeName={employee.name}
              providers={providersForChannelType(channelType)}
            />
          </Card>
        ) : (
          <EmptyState
            title={`${label} is not set up yet.`}
            description="Ask an organization admin to configure this channel."
          />
        )}
      </div>
    );
  }

  const provider = getMessagingProvider(channel.channelProvider);
  const credential = await store.getChannelProviderCredentialMetadata(
    organization.id,
    channel.channelProvider,
  );
  const encryptionConfigured = isChannelEncryptionConfigured();
  const envAvailable = provider?.isEnvConfigured() ?? false;
  const webhookSlug = PROVIDER_TO_SLUG[channel.channelProvider] ?? "custom";
  const webhookUrl = `${appUrl}/api/webhooks/channels/${webhookSlug}/${channel.publicKey}`;
  const recentEvents = await store.listChannelWebhookEventsForChannel(
    organization.id,
    channel.id,
    8,
  );

  return (
    <div className="mx-auto max-w-2xl">
      {backLink}
      <PageHeader
        eyebrow="Messaging"
        title={`${label} channel`}
        description={`Connect ${employee.name} to ${label}.`}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={channel.status === "active" ? "solid" : "outline"}>
          {CHANNEL_STATUS_LABELS[channel.status]}
        </Badge>
        <Badge tone="soft">
          {MESSAGING_PROVIDER_LABELS[channel.channelProvider] ?? channel.channelProvider}
        </Badge>
        {envAvailable || credential?.status === "active" ? (
          <Badge tone="outline">Provider connected</Badge>
        ) : (
          <Badge tone="outline">Simulated mode</Badge>
        )}
      </div>

      {!envAvailable && credential?.status !== "active" ? (
        <div className="mb-5">
          <Notice>
            No provider credentials are set, so this channel runs in simulated mode. Add credentials
            below (owner/admin) to go live, or test it in simulated mode now.
          </Notice>
        </div>
      ) : null}

      <div className="space-y-5">
        {canManage ? (
          <Card className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-taurus-text">Channel settings</h3>
              <MessagingStatusControls
                employeeId={employee.id}
                channelId={channel.id}
                channelType={channel.channelType}
                status={channel.status}
              />
            </div>
            <MessagingSettingsForm employeeId={employee.id} channel={channel} />
          </Card>
        ) : null}

        {canManage ? (
          <ProviderCredentialForm
            employeeId={employee.id}
            channelType={channel.channelType}
            providerType={channel.channelProvider}
            encryptionConfigured={encryptionConfigured}
            hasCredential={!!credential && credential.status === "active"}
            keyLastFour={credential?.keyLastFour ?? null}
            envAvailable={envAvailable}
          />
        ) : null}

        {canManage ? (
          <WebhookUrlPanel
            webhookUrl={webhookUrl}
            verificationNote={
              channel.channelProvider === "meta_whatsapp_cloud"
                ? "Meta also calls this URL with a GET verification challenge."
                : undefined
            }
          />
        ) : null}

        {canTest ? (
          <SimulateForm
            employeeId={employee.id}
            channelId={channel.id}
            senderPlaceholder={SENDER_PLACEHOLDER[channelType] ?? "+15551234567"}
          />
        ) : null}

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-taurus-text">Recent activity</h3>
          {recentEvents.length === 0 ? (
            <p className="mt-2 text-xs text-taurus-faint">No messages yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-xs">
                  <span className="text-taurus-sub">
                    {e.eventType === "inbound"
                      ? "Inbound message"
                      : e.eventType === "delivery_status"
                        ? "Reply / delivery"
                        : e.eventType}
                  </span>
                  <span className="text-taurus-faint">
                    {e.status} · {formatDate(e.receivedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
