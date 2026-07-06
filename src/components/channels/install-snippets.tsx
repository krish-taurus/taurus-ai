/**
 * Install snippets (Prompt 008).
 *
 * The copyable "add to website" code: widget script, iframe embed, hosted link,
 * and public API endpoint. Each has a copy button.
 */

import { Card } from "@/components/ui";
import { CopyButton } from "@/components/channels/copy-button";
import type { InstallSnippets } from "@/modules/channels/metadata";

function SnippetBlock({
  title,
  description,
  value,
  multiline,
}: {
  title: string;
  description: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-taurus-text">{title}</h3>
          <p className="mt-0.5 text-xs text-taurus-faint">{description}</p>
        </div>
        <CopyButton value={value} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-taurus-line bg-taurus-elevated">
        <pre className={`p-3 text-xs text-taurus-sub ${multiline ? "" : "whitespace-pre-wrap"}`}>
          <code>{value}</code>
        </pre>
      </div>
    </Card>
  );
}

export function InstallSnippetsView({ snippets }: { snippets: InstallSnippets }) {
  return (
    <div className="space-y-4">
      <SnippetBlock
        title="Website Widget"
        description="Add a floating chat launcher to any website. Paste before </body>."
        value={snippets.scriptSnippet}
        multiline
      />
      <SnippetBlock
        title="Iframe Embed"
        description="Embed the chat directly inside a page."
        value={snippets.iframeSnippet}
        multiline
      />
      <SnippetBlock
        title="Hosted Chat Link"
        description="Share this link — no website required."
        value={snippets.hostedLink}
      />
      <SnippetBlock
        title="Public API"
        description="Send messages from your own code (POST JSON: { message })."
        value={snippets.apiEndpoint}
      />
    </div>
  );
}
