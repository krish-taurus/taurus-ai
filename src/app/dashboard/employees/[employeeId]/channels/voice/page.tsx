import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { getClientEnv } from "@/lib/env/env";
import { formatDate } from "@/lib/format";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import type { VoiceProviderType } from "@/lib/db/types";
import { isChannelEncryptionConfigured } from "@/modules/channels/credentials";
import { CHANNEL_STATUS_LABELS } from "@/modules/channels/metadata";
import { computeVoiceReadiness } from "@/modules/voice-runtime/readiness";
import { VOICE_PROVIDER_LABELS } from "@/modules/voice-runtime/catalog";
import { getVoiceProvider, VOICE_PROVIDER_TO_SLUG } from "@/modules/voice-runtime/providers";
import { VoiceChannelForm } from "@/components/channels/voice/voice-channel-form";
import { VoiceStatusControls } from "@/components/channels/voice/voice-status-controls";
import { VoiceReadinessChecklist } from "@/components/channels/voice/voice-readiness-checklist";
import { VoiceCredentialForm } from "@/components/channels/voice/voice-credential-form";
import { ConnectionUrlPanel } from "@/components/channels/voice/connection-url-panel";
import { SimulateCallPanel } from "@/components/channels/voice/simulate-call-panel";
import { Badge, Card, EmptyState, Notice, PageHeader } from "@/components/ui";

const CALL_STATUS_LABELS: Record<string, string> = {
  ringing: "Ringing",
  active: "In progress",
  completed: "Completed",
  failed: "Failed",
  missed: "Missed",
  blocked: "Blocked",
};

export default async function VoiceSetupPage({ params }: { params: { employeeId: string } }) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "channel.view")) redirect("/dashboard");

  const store = getStore();
  const employee = await store.getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  const canManage = hasPermission(membership.role, "messaging_channel.manage");
  const canTest = hasPermission(membership.role, "channel.manage");

  const overview = await store.getVoiceChannelOverview(organization.id, employee.id);
  const channel = overview.channel;
  const phoneNumber = overview.phoneNumber;
  const readiness = await computeVoiceReadiness(store, {
    organizationId: organization.id,
    employee,
    channel,
    phoneNumber,
  });

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
          eyebrow="Phone Calls"
          title="Set up Voice Channel"
          description={`Let ${employee.name} answer phone calls.`}
        />
        {canManage ? (
          <Card className="p-6">
            <VoiceChannelForm
              employeeId={employee.id}
              employeeName={employee.name}
              channel={null}
              phoneNumber={null}
            />
          </Card>
        ) : (
          <EmptyState
            title="This Voice Channel is not set up yet."
            description="Ask an organization admin to configure phone calls."
          />
        )}
      </div>
    );
  }

  const slug = VOICE_PROVIDER_TO_SLUG[channel.channelProvider as VoiceProviderType] ?? "simulated";
  const connectionUrl = `${appUrl}/api/webhooks/voice/${slug}/${channel.publicKey}`;
  const provider = getVoiceProvider(channel.channelProvider);
  const credential = await store.getChannelProviderCredentialMetadata(
    organization.id,
    channel.channelProvider,
  );

  return (
    <div className="mx-auto max-w-2xl">
      {backLink}
      <PageHeader
        eyebrow="Phone Calls"
        title="Voice Channel"
        description={`Let ${employee.name} answer phone calls.`}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={channel.status === "active" ? "solid" : "outline"}>
          {CHANNEL_STATUS_LABELS[channel.status]}
        </Badge>
        <Badge tone="soft">
          {VOICE_PROVIDER_LABELS[channel.channelProvider as VoiceProviderType] ??
            channel.channelProvider}
        </Badge>
        {readiness.channelActive ? null : <Badge tone="outline">Not active</Badge>}
      </div>

      <div className="space-y-5">
        <Card className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-taurus-text">Ready to take calls?</h3>
            {canManage ? (
              <VoiceStatusControls
                employeeId={employee.id}
                channelId={channel.id}
                status={channel.status}
              />
            ) : null}
          </div>
          <VoiceReadinessChecklist readiness={readiness} employeeId={employee.id} />
        </Card>

        <SimulateCallPanel
          employeeId={employee.id}
          channelId={channel.id}
          canSimulate={canTest && readiness.canSimulate}
        />

        {overview.recentCalls.length > 0 ? (
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-taurus-text">Recent calls</h3>
            <ul className="mt-3 space-y-2">
              {overview.recentCalls.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-xs">
                  <span className="text-taurus-sub">
                    {CALL_STATUS_LABELS[c.status] ?? c.status}
                    {c.durationSeconds != null ? ` · ${c.durationSeconds}s` : ""}
                  </span>
                  <span className="text-taurus-faint">{formatDate(c.startedAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {canManage ? (
          <Card className="p-6">
            <h3 className="mb-4 text-sm font-semibold text-taurus-text">Voice Channel settings</h3>
            <VoiceChannelForm
              employeeId={employee.id}
              employeeName={employee.name}
              channel={channel}
              phoneNumber={phoneNumber?.phoneNumber ?? null}
            />
          </Card>
        ) : null}

        {canManage && provider ? (
          <VoiceCredentialForm
            employeeId={employee.id}
            providerType={channel.channelProvider}
            encryptionConfigured={isChannelEncryptionConfigured()}
            hasCredential={!!credential && credential.status === "active"}
            keyLastFour={credential?.keyLastFour ?? null}
            envAvailable={provider.isEnvConfigured()}
          />
        ) : null}

        {canManage ? <ConnectionUrlPanel connectionUrl={connectionUrl} /> : null}

        <Notice>
          Real-time call audio, barge-in, and call recording storage are foundation only in this
          release. Use Simulate Phone Call to test the full experience today.
        </Notice>
      </div>
    </div>
  );
}
