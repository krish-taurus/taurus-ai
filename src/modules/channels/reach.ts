/**
 * "Reach me" links (Sprint 037) — pure, client-safe.
 *
 * The customer-facing link for a channel: scan/tap it to open a chat with the AI
 * Employee. This is the safe, ToS-compliant flavor of "connect by QR" — a code
 * customers scan to REACH the assistant, not an auth code that links a private
 * account. Renders to a QR wherever a channel exposes a public entry point:
 *   - Web surfaces → the hosted chat page
 *   - Telegram     → t.me/<username> (needs the configured username)
 *   - WhatsApp     → wa.me/<number>
 *   - SMS          → sms:<number>
 */

import type { ChannelType, EmployeeChannel } from "@/lib/db/types";

export interface ReachLink {
  /** Customer-facing label, e.g. "Open in Telegram". */
  label: string;
  /** Short hint shown under the QR. */
  hint: string;
  url: string;
}

const WEB_TYPES: ChannelType[] = ["website_widget", "hosted_chat", "iframe_embed", "public_api"];

function senderId(channel: EmployeeChannel): string {
  const raw = channel.providerConfig?.senderId;
  return typeof raw === "string" ? raw.trim() : "";
}

/** Digits only, for wa.me / sms: links. */
function phoneDigits(value: string): string {
  return value.replace(/[^\d]/g, "");
}

/**
 * Build the customer-facing "reach me" link for a channel, or null when the
 * channel has no public entry point yet (e.g. Telegram without a username).
 * `appUrl` should have no trailing slash.
 */
export function buildReachLink(channel: EmployeeChannel, appUrl: string): ReachLink | null {
  const base = appUrl.replace(/\/$/, "");

  if (WEB_TYPES.includes(channel.channelType)) {
    return {
      label: "Open the chat",
      hint: "Scan to chat with this AI Employee in the browser — no app needed.",
      url: `${base}/public/chat/${channel.publicKey}`,
    };
  }

  if (channel.channelType === "telegram") {
    const username = senderId(channel).replace(/^@/, "");
    if (!username) return null;
    return {
      label: "Open in Telegram",
      hint: "Scan to start a Telegram chat with this AI Employee.",
      url: `https://t.me/${username}`,
    };
  }

  if (channel.channelType === "whatsapp") {
    const digits = phoneDigits(senderId(channel));
    if (!digits) return null;
    return {
      label: "Open in WhatsApp",
      hint: "Scan to message this AI Employee on WhatsApp.",
      url: `https://wa.me/${digits}`,
    };
  }

  if (channel.channelType === "sms") {
    const digits = phoneDigits(senderId(channel));
    if (!digits) return null;
    return {
      label: "Text this number",
      hint: "Scan to open a text message to this AI Employee.",
      url: `sms:${digits}`,
    };
  }

  return null;
}
