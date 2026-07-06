/**
 * Hosted public chat page (Prompt 008).
 *
 * Public, no dashboard auth. Resolves the channel by public key and shows a
 * premium monochrome chat surface. No dashboard navigation, no admin controls,
 * no private organization data.
 */

import { getStore } from "@/lib/db/store";
import { resolveActiveChannel, PublicChannelError } from "@/modules/channels/runtime";
import { PublicChat } from "@/components/channels/public-chat";

export const dynamic = "force-dynamic";

function Unavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-taurus-app px-6 text-center">
      <div>
        <p className="text-base text-taurus-text">This chat is not available.</p>
        <p className="mt-1 text-sm text-taurus-faint">
          The link may be paused or no longer active.
        </p>
      </div>
    </div>
  );
}

export default async function HostedChatPage({ params }: { params: { publicKey: string } }) {
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

  const welcome =
    channel.welcomeMessage?.trim() ||
    `Hi! I'm ${channel.appearance.employeeDisplayName}. How can I help?`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-taurus-app p-4 sm:p-6">
      <div className="flex h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-taurus-line shadow-2xl sm:h-[720px]">
        <PublicChat
          publicKey={channel.publicKey}
          employeeName={channel.appearance.employeeDisplayName || employee.name}
          roleTitle={employee.roleTitle}
          welcomeMessage={welcome}
          showSources={channel.appearance.showSources}
          variant="page"
        />
      </div>
      {channel.appearance.brandName ? (
        <p className="sr-only">Powered by {channel.appearance.brandName}</p>
      ) : null}
    </div>
  );
}
