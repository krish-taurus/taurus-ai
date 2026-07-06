"use client";

/** Copy-to-clipboard button (Prompt 008). */

import { useState } from "react";
import { buttonClasses } from "@/components/ui";

export function CopyButton({
  value,
  label = "Copy",
  size = "sm",
}: {
  value: string;
  label?: string;
  size?: "sm" | "md";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className={buttonClasses("secondary", size)}>
      {copied ? "Copied" : label}
    </button>
  );
}
