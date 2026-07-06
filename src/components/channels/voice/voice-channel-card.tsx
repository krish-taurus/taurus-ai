/**
 * Phone Calls card (Prompt 010).
 *
 * Shown in the Channels page Voice section. Non-technical: status, provider,
 * phone number, and a Configure CTA. No secrets or provider internals here.
 */

import Link from "next/link";
import { formatDate } from "@/lib/format";
import { Badge, buttonClasses, Card } from "@/components/ui";
import { CHANNEL_STATUS_LABELS } from "@/modules/channels/metadata";
import { VOICE_PROVIDER_LABELS } from "@/modules/voice-runtime/catalog";
import type { VoiceChannelOverview, VoiceProviderType } from "@/lib/db/types";

export function VoiceChannelCard({
  employeeId,
  overview,
}: {
  employeeId: string;
  overview: VoiceChannelOverview;
}) {
  const channel = overview.channel;
  const configured = !!channel;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-taurus-text">Phone Calls</h3>
        {configured ? (
          <Badge tone={channel!.status === "active" ? "solid" : "outline"}>
            {CHANNEL_STATUS_LABELS[channel!.status]}
          </Badge>
        ) : (
          <Badge tone="outline">Not set up</Badge>
        )}
      </div>
      <dl className="mt-2 space-y-1 text-xs text-taurus-faint">
        <div className="flex justify-between gap-2">
          <dt>Provider</dt>
          <dd className="text-taurus-sub">
            {overview.providerType
              ? (VOICE_PROVIDER_LABELS[overview.providerType as VoiceProviderType] ??
                overview.providerType)
              : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Phone number</dt>
          <dd className="text-taurus-sub">{overview.phoneNumber?.phoneNumber ?? "Not added"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Last call</dt>
          <dd className="text-taurus-sub">
            {overview.lastCallAt ? formatDate(overview.lastCallAt) : "—"}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/employees/${employeeId}/channels/voice`}
          className={buttonClasses("secondary", "sm")}
        >
          {configured ? "Configure Voice" : "Set up"}
        </Link>
      </div>
    </Card>
  );
}
