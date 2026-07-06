/**
 * Developer webhook URL panel (Prompt 009).
 *
 * Shows the copyable provider webhook URL. Rendered only for owners/admins. No
 * secrets — the public key is safe to place in a provider console.
 */

import { Card } from "@/components/ui";
import { CopyButton } from "@/components/channels/copy-button";

export function WebhookUrlPanel({
  webhookUrl,
  verificationNote,
}: {
  webhookUrl: string;
  verificationNote?: string;
}) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-taurus-text">Developer: webhook URL</h3>
          <p className="mt-0.5 text-xs text-taurus-faint">
            Paste this into the provider console to receive inbound messages.
          </p>
        </div>
        <CopyButton value={webhookUrl} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-taurus-line bg-taurus-elevated">
        <pre className="p-3 text-xs text-taurus-sub">
          <code>{webhookUrl}</code>
        </pre>
      </div>
      {verificationNote ? (
        <p className="mt-2 text-xs text-taurus-faint">{verificationNote}</p>
      ) : null}
    </Card>
  );
}
