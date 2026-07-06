/**
 * Developer connection URL panel (Prompt 010).
 *
 * Shows the copyable provider connection URL. Rendered only for owners/admins. No
 * secrets — the public key is safe to place in a provider console.
 */

import { Card } from "@/components/ui";
import { CopyButton } from "@/components/channels/copy-button";

export function ConnectionUrlPanel({ connectionUrl }: { connectionUrl: string }) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-taurus-text">Developer: connection URL</h3>
          <p className="mt-0.5 text-xs text-taurus-faint">
            Paste this into your telephony provider console to route inbound calls.
          </p>
        </div>
        <CopyButton value={connectionUrl} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-taurus-line bg-taurus-elevated">
        <pre className="p-3 text-xs text-taurus-sub">
          <code>{connectionUrl}</code>
        </pre>
      </div>
    </Card>
  );
}
