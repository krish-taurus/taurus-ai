"use client";

/**
 * "Reach me" QR card (Sprint 037).
 *
 * Shows a scannable QR + the link a customer uses to open a chat with the AI
 * Employee. The QR always renders dark-on-white (what scanners expect) so it
 * stays reliable in either theme. The SVG is generated server-side and passed
 * in as a string.
 */

import { useState } from "react";
import { buttonClasses, Card } from "@/components/ui";

export function ReachQr({
  svg,
  url,
  label,
  hint,
}: {
  svg: string;
  url: string;
  label: string;
  hint: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-taurus-text">Scan to chat</h3>
      <p className="mt-1 text-xs text-taurus-faint">{hint}</p>
      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div
          className="h-40 w-40 shrink-0 rounded-xl bg-white p-3 text-black shadow-sm [&_svg]:h-full [&_svg]:w-full"
          aria-label={`QR code linking to ${url}`}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-taurus-text">{label}</p>
          <p className="mt-0.5 break-all text-sm text-taurus-sub">{url}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={url} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "sm")}>
              Open link
            </a>
            <button type="button" onClick={copy} className={buttonClasses("secondary", "sm")}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
