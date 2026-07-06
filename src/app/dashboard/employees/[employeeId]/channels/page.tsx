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
  const [readiness, overview] = await Promise.all([
    computeChatReadiness(store, { organizationId: organization.id, employee }),
    store.getChannelOverview(organization.id, employee.id),
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

      {/* Full channel catalog (Messaging / Phone / Workplace are coming soon) */}
      <ChannelCatalogCards />
    </div>
  );
}
