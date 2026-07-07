/**
 * Connection card (Sprint 014) — one configured connection in the global list.
 *
 * Presentational + server-safe. Shows status, connected AI Employee, provider,
 * last activity, and setup state, with Configure / Test CTAs. No secrets are ever
 * shown — only non-sensitive channel metadata.
 */

import Link from "next/link";
import type { EmployeeChannel } from "@/lib/db/types";
import { formatDate } from "@/lib/format";
import {
  CONNECTION_SETUP_STATE_LABELS,
  CONNECTION_STATUS_LABELS,
  connectionSetupHref,
  connectionTestAvailable,
  connectionTypeLabel,
  providerLabel,
} from "@/modules/channels/connections";
import { Badge, buttonClasses, Card } from "@/components/ui";

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-taurus-faint">{label}</dt>
      <dd className="truncate text-right font-medium text-taurus-text">{value}</dd>
    </div>
  );
}

export function ConnectionCard({
  channel,
  employeeName,
  canManage,
}: {
  channel: EmployeeChannel;
  employeeName: string;
  canManage: boolean;
}) {
  const href = connectionSetupHref(channel.employeeId, channel.channelType);
  const testable = connectionTestAvailable(channel.status);

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-taurus-text">
          {connectionTypeLabel(channel.channelType)}
        </h3>
        <Badge tone={channel.status === "active" ? "solid" : "outline"}>
          {CONNECTION_STATUS_LABELS[channel.status]}
        </Badge>
      </div>

      <dl className="space-y-1.5 text-xs">
        <MetaRow label="AI Employee" value={employeeName} />
        <MetaRow label="Provider" value={providerLabel(channel.channelProvider)} />
        <MetaRow label="Setup state" value={CONNECTION_SETUP_STATE_LABELS[channel.status]} />
        <MetaRow label="Last activity" value={formatDate(channel.updatedAt)} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-taurus-line pt-4">
        <Link href={href} className={buttonClasses("secondary", "sm")}>
          {canManage ? "Configure" : "View"}
        </Link>
        {testable ? (
          <Link href={href} className={buttonClasses("ghost", "sm")}>
            Test
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
