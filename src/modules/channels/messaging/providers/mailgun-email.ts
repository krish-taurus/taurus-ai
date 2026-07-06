/**
 * Mailgun email provider (Prompt 009) — email foundation.
 *
 * Parses Mailgun inbound routes (sender/recipient/subject/body-plain) into a safe
 * plain-text message (HTML is stripped, never rendered), verifies the Mailgun
 * webhook signature when a signing key is configured, and sends replies via the
 * Mailgun Messages API when live.
 */

import type {
  MessagingDeliveryEvent,
  MessagingInboundMessage,
  MessagingOutboundRequest,
  MessagingProvider,
  MessagingProviderConfig,
  ProviderSendResult,
  VerifyResult,
  WebhookRequest,
} from "@/modules/channels/messaging/types";
import { preferPlainText } from "@/modules/channels/messaging/html";
import { hmacHex, timingSafeEqual } from "@/modules/channels/messaging/crypto";

function extractEmail(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
}

export const mailgunProvider: MessagingProvider = {
  providerType: "mailgun",
  displayName: "Mailgun",
  supportedChannelTypes: ["email"],

  parseInboundWebhook(request: WebhookRequest): MessagingInboundMessage | null {
    const form = request.form;
    const from = form.sender ?? form.from ?? "";
    if (!from) return null;
    const text = preferPlainText(form["body-plain"] ?? form["stripped-text"], form["body-html"]);
    if (!text.trim()) return null;
    const sender = extractEmail(from);
    return {
      providerType: "mailgun",
      channelType: "email",
      externalConversationId: sender,
      externalMessageId: form["Message-Id"] ?? form["message-id"] ?? "",
      senderExternalId: sender,
      senderLabel:
        form.from && form.from.includes("<") ? form.from.split("<")[0].trim() || null : null,
      messageText: text,
      contentType: "email",
      receivedAt: null,
      metadata: { subject: form.subject ?? null },
    };
  },

  parseDeliveryStatus(request: WebhookRequest): MessagingDeliveryEvent | null {
    const data = (
      request.json as {
        "event-data"?: { event?: string; message?: { headers?: { "message-id"?: string } } };
      }
    )?.["event-data"];
    if (!data || !data.event) return null;
    const map: Record<string, MessagingDeliveryEvent["deliveryStatus"]> = {
      delivered: "delivered",
      opened: "read",
      failed: "failed",
      accepted: "sent",
    };
    return {
      providerType: "mailgun",
      externalMessageId: data.message?.headers?.["message-id"] ?? "",
      deliveryStatus: map[data.event] ?? "sent",
      timestamp: null,
      metadata: {},
    };
  },

  async verifyWebhook(
    request: WebhookRequest,
    config: MessagingProviderConfig,
  ): Promise<VerifyResult> {
    const signingKey = config.secrets.signingKey ?? config.secrets.apiKey;
    if (!signingKey) return { verified: false, reason: "not_configured" };
    const { timestamp, token, signature } = request.form;
    if (!timestamp || !token || !signature) return { verified: false, reason: "missing_signature" };
    const expected = await hmacHex("SHA-256", signingKey, `${timestamp}${token}`);
    return { verified: timingSafeEqual(expected, signature), reason: "signature_checked" };
  },

  async sendMessage(
    request: MessagingOutboundRequest,
    config: MessagingProviderConfig,
  ): Promise<ProviderSendResult> {
    const apiKey = config.secrets.apiKey;
    const domain = config.secrets.domain ?? String(config.channelConfig.domain ?? "");
    const fromEmail = String(config.channelConfig.senderId ?? "");
    if (!apiKey || !domain || !fromEmail) {
      return { status: "simulated", externalMessageId: null, errorCode: null };
    }
    const subject = String(request.metadata.subject ?? "Re: your message");
    const params = new URLSearchParams({
      from: fromEmail,
      to: request.recipientExternalId,
      subject,
      text: request.messageText,
    });
    try {
      const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
        },
        body: params.toString(),
      });
      if (!res.ok)
        return { status: "failed", externalMessageId: null, errorCode: `http_${res.status}` };
      const data = (await res.json()) as { id?: string };
      return { status: "sent", externalMessageId: data.id ?? null, errorCode: null };
    } catch {
      return { status: "failed", externalMessageId: null, errorCode: "network_error" };
    }
  },

  getProviderStatus(config: MessagingProviderConfig): {
    mode: "live" | "simulated" | "unavailable";
  } {
    if (config.secrets.apiKey && (config.secrets.domain || config.channelConfig.domain)) {
      return { mode: "live" };
    }
    return { mode: "simulated" };
  },

  isEnvConfigured(): boolean {
    return !!(process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN);
  },
};
