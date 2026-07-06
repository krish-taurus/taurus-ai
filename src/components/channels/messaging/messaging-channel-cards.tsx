/**
 * Messaging channel cards (Prompt 009).
 *
 * The WhatsApp / SMS / Email cards shown in the Channels page Messaging section.
 * Non-technical: status, provider, and a Configure CTA. No secrets or webhook
 * internals here.
 */

import Link from "next/link";
import { formatDate } from "@/lib/format";
import { Badge, buttonClasses, Card } from "@/components/ui";
import { CHANNEL_STATUS_LABELS } from "@/modules/channels/metadata";
import {
  MESSAGING_CHANNEL_LABELS,
  MESSAGING_PROVIDER_LABELS,
} from "@/modules/channels/messaging/catalog";
import type { MessagingChannelSummary } from "@/lib/db/types";

export function MessagingChannelCards({
  employeeId,
  summaries,
}: {
  employeeId: string;
  summaries: MessagingChannelSummary[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {summaries.map((s) => {
        const label = MESSAGING_CHANNEL_LABELS[s.channelType] ?? s.channelType;
        const configured = !!s.channel;
        return (
          <Card key={s.channelType} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-taurus-text">{label}</h3>
              {configured ? (
                <Badge tone={s.channel!.status === "active" ? "solid" : "outline"}>
                  {CHANNEL_STATUS_LABELS[s.channel!.status]}
                </Badge>
              ) : (
                <Badge tone="outline">Not set up</Badge>
              )}
            </div>
            <dl className="mt-2 space-y-1 text-xs text-taurus-faint">
              <div className="flex justify-between gap-2">
                <dt>Provider</dt>
                <dd className="text-taurus-sub">
                  {s.providerType
                    ? (MESSAGING_PROVIDER_LABELS[s.providerType] ?? s.providerType)
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Last message</dt>
                <dd className="text-taurus-sub">
                  {s.lastMessageAt ? formatDate(s.lastMessageAt) : "—"}
                </dd>
              </div>
            </dl>
            <div className="mt-3">
              <Link
                href={`/dashboard/employees/${employeeId}/channels/messaging/${s.channelType}`}
                className={buttonClasses("secondary", "sm")}
              >
                {configured ? "Configure" : "Set up"}
              </Link>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
