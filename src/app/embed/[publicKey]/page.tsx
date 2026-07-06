/**
 * Iframe embed surface (Prompt 008).
 *
 * Public, no dashboard auth. Optimized for embedding: full-bleed, no page chrome,
 * responsive to the iframe height. Records a metadata-only widget.loaded event.
 */

import { getStore } from "@/lib/db/store";
import { resolveActiveChannel, PublicChannelError } from "@/modules/channels/runtime";
import { PublicChat } from "@/components/channels/public-chat";

export const dynamic = "force-dynamic";

function Unavailable() {
  return (
    <div className="flex h-screen items-center justify-center bg-taurus-app px-6 text-center">
      <p className="text-sm text-taurus-faint">This chat is not available.</p>
    </div>
  );
}

export default async function EmbedChatPage({ params }: { params: { publicKey: string } }) {
  const store = getStore();

  let channel;
  let employee;
  try {
    const resolved = await resolveActiveChannel(store, params.publicKey);
    channel = resolved.channel;
    employee = resolved.employee;
  } catch (error) {
    if (error instanceof PublicChannelError) return <Unavailable />;
    throw error;
  }

  // Metadata-only load event (never message contents).
  await store.createPublicChannelEvent({
    organizationId: channel.organizationId,
    employeeId: channel.employeeId,
    channelId: channel.id,
    eventType: "widget.loaded",
    metadata: { channelType: channel.channelType },
  });

  const welcome =
    channel.welcomeMessage?.trim() ||
    `Hi! I'm ${channel.appearance.employeeDisplayName}. How can I help?`;

  return (
    <div className="h-screen bg-taurus-app">
      <PublicChat
        publicKey={channel.publicKey}
        employeeName={channel.appearance.employeeDisplayName || employee.name}
        roleTitle={employee.roleTitle}
        welcomeMessage={welcome}
        showSources={channel.appearance.showSources}
        variant="embed"
      />
    </div>
  );
}
