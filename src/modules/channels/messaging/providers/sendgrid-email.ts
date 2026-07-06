/**
 * SendGrid email provider (Prompt 009) — email foundation.
 *
 * Parses SendGrid Inbound Parse form posts (from/to/subject/text/html) into a
 * safe plain-text message (HTML is stripped, never rendered) and sends replies
 * via the SendGrid Mail Send API when live.
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

function extractEmail(value: string): string {
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
}

export const sendgridProvider: MessagingProvider = {
  providerType: "sendgrid",
  displayName: "SendGrid",
  supportedChannelTypes: ["email"],

  parseInboundWebhook(request: WebhookRequest): MessagingInboundMessage | null {
    const form = request.form;
    const from = form.from ?? "";
    if (!from) return null;
    const text = preferPlainText(form.text, form.html);
    if (!text.trim()) return null;
    const sender = extractEmail(from);
    return {
      providerType: "sendgrid",
      channelType: "email",
      externalConversationId: sender,
      externalMessageId: form["message-id"] ?? "",
      senderExternalId: sender,
      senderLabel: from.includes("<") ? from.split("<")[0].trim() || null : null,
      messageText: text,
      contentType: "email",
      receivedAt: null,
      metadata: { subject: form.subject ?? null },
    };
  },

  parseDeliveryStatus(request: WebhookRequest): MessagingDeliveryEvent | null {
    // SendGrid Event Webhook posts a JSON array of events.
    const events = Array.isArray(request.json)
      ? (request.json as Array<Record<string, unknown>>)
      : [];
    const ev = events[0];
    if (!ev || !ev.sg_message_id || !ev.event) return null;
    const status = String(ev.event);
    const map: Record<string, MessagingDeliveryEvent["deliveryStatus"]> = {
      delivered: "delivered",
      open: "read",
      bounce: "failed",
      dropped: "failed",
      deferred: "queued",
      processed: "sent",
    };
    return {
      providerType: "sendgrid",
      externalMessageId: String(ev.sg_message_id),
      deliveryStatus: map[status] ?? "sent",
      timestamp: null,
      metadata: {},
    };
  },

  async verifyWebhook(
    _request: WebhookRequest,
    config: MessagingProviderConfig,
  ): Promise<VerifyResult> {
    void _request;
    // Inbound Parse is not signed by default; live setups rely on a secret URL /
    // basic auth. Only accept once an API key is configured for this org.
    if (!config.secrets.apiKey) return { verified: false, reason: "not_configured" };
    return { verified: true, reason: "api_key_present" };
  },

  async sendMessage(
    request: MessagingOutboundRequest,
    config: MessagingProviderConfig,
  ): Promise<ProviderSendResult> {
    const apiKey = config.secrets.apiKey;
    const fromEmail = String(config.channelConfig.senderId ?? "");
    if (!apiKey || !fromEmail) {
      return { status: "simulated", externalMessageId: null, errorCode: null };
    }
    const subject = String(request.metadata.subject ?? "Re: your message");
    try {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: request.recipientExternalId }] }],
          from: { email: fromEmail },
          subject,
          content: [{ type: "text/plain", value: request.messageText }],
        }),
      });
      if (!res.ok)
        return { status: "failed", externalMessageId: null, errorCode: `http_${res.status}` };
      return {
        status: "sent",
        externalMessageId: res.headers.get("x-message-id"),
        errorCode: null,
      };
    } catch {
      return { status: "failed", externalMessageId: null, errorCode: "network_error" };
    }
  },

  getProviderStatus(config: MessagingProviderConfig): {
    mode: "live" | "simulated" | "unavailable";
  } {
    if (config.secrets.apiKey && config.channelConfig.senderId) return { mode: "live" };
    return { mode: "simulated" };
  },

  isEnvConfigured(): boolean {
    return !!process.env.SENDGRID_API_KEY;
  },
};
