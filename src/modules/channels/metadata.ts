/**
 * Channel labels + install snippet builders (Prompt 008).
 *
 * Business-friendly language only. Snippets are the copyable install code shown
 * on the Channels page.
 */

import type { ChannelStatus } from "@/lib/db/types";

export const CHANNEL_STATUS_LABELS: Record<ChannelStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

export interface InstallSnippets {
  scriptSnippet: string;
  iframeSnippet: string;
  hostedLink: string;
  apiEndpoint: string;
}

/** Build the copyable install snippets for a web channel. */
export function buildInstallSnippets(
  appUrl: string,
  publicKey: string,
  options: { theme: "dark" | "light"; position: "bottom-right" | "bottom-left" },
): InstallSnippets {
  const base = appUrl.replace(/\/$/, "");
  const scriptSnippet = `<script>
  window.TaurusAI = {
    channelId: "${publicKey}",
    theme: "${options.theme}",
    position: "${options.position}"
  };
</script>
<script async src="${base}/widget/taurus-widget.js"></script>`;

  const iframeSnippet = `<iframe
  src="${base}/embed/${publicKey}"
  width="100%"
  height="700"
  style="border:0;border-radius:16px;"
></iframe>`;

  return {
    scriptSnippet,
    iframeSnippet,
    hostedLink: `${base}/public/chat/${publicKey}`,
    apiEndpoint: `${base}/api/public/channels/${publicKey}/messages`,
  };
}
