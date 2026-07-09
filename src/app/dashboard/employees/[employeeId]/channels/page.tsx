import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStore } from "@/lib/db/store";
import { getClientEnv } from "@/lib/env/env";
import { requireCurrentOrganization } from "@/lib/security/guards";
import { hasPermission } from "@/modules/organizations/roles";
import { computeChatReadiness } from "@/modules/employee-chat/readiness";
import { buildInstallSnippets, CHANNEL_STATUS_LABELS } from "@/modules/channels/metadata";
import { ChannelCatalogCards } from "@/components/channels/channel-catalog-cards";
import { InstallSnippetsView } from "@/components/channels/install-snippets";
import { CreateChannelButton } from "@/components/channels/create-channel-button";
import { ChannelStatusControls } from "@/components/channels/channel-status-controls";
import { ChannelSettingsForm } from "@/components/channels/channel-settings-form";
import { MessagingChannelCards } from "@/components/channels/messaging/messaging-channel-cards";
import { VoiceChannelCard } from "@/components/channels/voice/voice-channel-card";
import { buildReachLink } from "@/modules/channels/reach";
import { renderQrSvg } from "@/lib/qr";
import { ReachQr } from "@/components/channels/reach-qr";
import { Badge, buttonClasses, Card, Notice, PageHeader, StatusDot } from "@/components/ui";

function ChecklistRow({ done, label, hint }: { done: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1">
        <StatusDot level={done ? 3 : 0} />
      </span>
      <div>
        <p className="text-sm font-medium text-taurus-text">{label}</p>
        <p className="text-xs text-taurus-faint">{hint}</p>
      </div>
    </li>
  );
}

export default async function ChannelsPage({ params }: { params: { employeeId: string } }) {
  const { organization, membership } = await requireCurrentOrganization();
  if (!hasPermission(membership.role, "channel.view")) {
    redirect("/dashboard");
  }

  const store = getStore();
  const employee = await store.getEmployee(organization.id, params.employeeId);
  if (!employee) notFound();

  const canManage = hasPermission(membership.role, "channel.manage");
  const [readiness, overview, messagingOverview, voiceOverview] = await Promise.all([
    computeChatReadiness(store, { organizationId: organization.id, employee }),
    store.getChannelOverview(organization.id, employee.id),
    store.getMessagingChannelOverview(organization.id, employee.id),
    store.getVoiceChannelOverview(organization.id, employee.id),
  ]);
  const webChannel = overview.webChannel;
  const appUrl = getClientEnv().NEXT_PUBLIC_APP_URL;
  const snippets = webChannel
    ? buildInstallSnippets(appUrl, webChannel.publicKey, {
        theme: webChannel.appearance.theme,
        position: webChannel.appearance.position,
      })
    : null;

  const brainReady = readiness.brainMode !== "unavailable";

  // A "reach me" QR for the live hosted chat (once the web channel is active).
  const webReach = webChannel ? buildReachLink(webChannel, appUrl) : null;
  const webReachSvg =
    webChannel?.status === "active" && webReach ? await renderQrSvg(webReach.url) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-4 text-sm">
        <Link
          href={`/dashboard/employees/${employee.id}`}
          className="font-medium text-taurus-sub hover:text-taurus-text"
        >
          ← {employee.name}
        </Link>
      </p>

      <PageHeader
        eyebrow="Channels"
        title="Add to Website"
        description={`Deploy ${employee.name} to your website, and beyond.`}
        action={
          !webChannel && canManage ? <CreateChannelButton employeeId={employee.id} /> : undefined
        }
      />

      <Card className="mb-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-taurus-text">Ready to deploy?</h2>
        <ul className="space-y-3">
          <ChecklistRow
            done={employee.status === "active"}
            label="Employee active"
            hint={employee.status === "active" ? "Active." : "Activate this AI Employee first."}
          />
          <ChecklistRow
            done={readiness.dnaPublished}
            label="Employee DNA published"
            hint={readiness.dnaPublished ? "Ready." : "Publish DNA so it can respond."}
          />
          <ChecklistRow
            done={readiness.assignedKnowledgeCount > 0}
            label="Knowledge assigned"
            hint={
              readiness.assignedKnowledgeCount > 0
                ? `${readiness.assignedKnowledgeCount} source(s) assigned.`
                : "Optional, but recommended for grounded answers."
            }
          />
          <ChecklistRow
            done={brainReady}
            label="Employee Brain ready"
            hint={
              readiness.brainMode === "live"
                ? "A model provider is connected."
                : readiness.brainMode === "local_demo"
                  ? "Using the local demo brain for testing."
                  : "Connect a model provider in Model Hub."
            }
          />
        </ul>
      </Card>

      {/* Website deployment */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-taurus-text">Website</h2>
          <Badge tone="solid">Available now</Badge>
        </div>

        {!webChannel ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-taurus-text">
              Add {employee.name} to your website in one line of code.
            </p>
            <p className="mt-1 text-xs text-taurus-faint">
              You&apos;ll get a widget, an embeddable chat, a shareable link, and an API.
            </p>
            {canManage ? (
              <div className="mt-5 flex justify-center">
                <CreateChannelButton employeeId={employee.id} />
              </div>
            ) : (
              <p className="mt-4 text-xs text-taurus-faint">
                Ask an admin to add this AI Employee to your website.
              </p>
            )}
          </Card>
        ) : (
          <div className="space-y-5">
            <Card className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-taurus-text">{webChannel.name}</h3>
                  <Badge tone={webChannel.status === "active" ? "solid" : "outline"}>
                    {CHANNEL_STATUS_LABELS[webChannel.status]}
                  </Badge>
                </div>
                {canManage ? (
                  <ChannelStatusControls
                    employeeId={employee.id}
                    channelId={webChannel.id}
                    status={webChannel.status}
                  />
                ) : null}
              </div>
              {webChannel.status !== "active" ? (
                <div className="mt-4">
                  <Notice>
                    This channel is {CHANNEL_STATUS_LABELS[webChannel.status].toLowerCase()}.
                    Activate it to make the links and embeds work.
                  </Notice>
                </div>
              ) : null}
            </Card>

            {snippets ? <InstallSnippetsView snippets={snippets} /> : null}

            {webReachSvg && webReach ? (
              <ReachQr svg={webReachSvg} url={webReach.url} label={webReach.label} hint={webReach.hint} />
            ) : null}

            <div className="flex flex-wrap gap-3">
              <a
                href={snippets?.hostedLink}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses("secondary")}
              >
                Open hosted chat
              </a>
            </div>

            {canManage ? (
              <Card className="p-6">
                <h3 className="mb-4 text-sm font-semibold text-taurus-text">Channel settings</h3>
                <ChannelSettingsForm employeeId={employee.id} channel={webChannel} />
              </Card>
            ) : null}
          </div>
        )}
      </section>

      {/* Messaging channels (WhatsApp / SMS / Email). */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-taurus-text">Messaging</h2>
          <Badge tone="soft">Foundation</Badge>
        </div>
        <p className="mb-3 text-xs text-taurus-faint">
          Connect this AI Employee to Telegram, WhatsApp, SMS, and email. Telegram just needs an
          access token from @BotFather; WhatsApp/SMS/email may require an account with Twilio, Meta
          WhatsApp Cloud, SendGrid, or Mailgun. You can test each channel in simulated mode before
          going live.
        </p>
        <MessagingChannelCards employeeId={employee.id} summaries={messagingOverview.summaries} />
      </section>

      {/* Voice channel (Phone Calls). */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-taurus-text">Phone Calls</h2>
          <Badge tone="soft">Foundation</Badge>
        </div>
        <p className="mb-3 text-xs text-taurus-faint">
          Let this AI Employee answer phone calls. Test it end to end with Simulate Phone Call
          before connecting a real number through Twilio, Telnyx, or Vonage.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <VoiceChannelCard employeeId={employee.id} overview={voiceOverview} />
        </div>
      </section>

      {/* Workplace apps (Slack live; Teams coming soon). */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-taurus-text">Workplace apps</h2>
          <Badge tone="soft">Foundation</Badge>
        </div>
        <p className="mb-3 text-xs text-taurus-faint">
          Bring this AI Employee into Slack with one tap — authorize the app and it replies to
          messages and mentions in your workspace.
        </p>
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <h3 className="text-sm font-medium text-taurus-text">Slack</h3>
            <p className="text-xs text-taurus-faint">Replies to messages &amp; @-mentions in your workspace.</p>
          </div>
          <Link
            href={`/dashboard/employees/${employee.id}/channels/slack`}
            className={buttonClasses("secondary", "sm")}
          >
            {canManage ? "Set up Slack" : "View Slack"}
          </Link>
        </Card>
      </section>

      {/* Full channel catalog (remaining apps are coming soon) */}
      <ChannelCatalogCards />
    </div>
  );
}
