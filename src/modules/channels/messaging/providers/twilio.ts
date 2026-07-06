/**
 * Twilio messaging provider (Prompt 009) — SMS + WhatsApp foundation.
 *
 * Parses Twilio's form-encoded inbound webhooks and delivery callbacks, verifies
 * the X-Twilio-Signature when an auth token is configured, and sends via the
 * Twilio REST API when live. Real network calls only happen with credentials —
 * never in tests or local dev without them.
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
import type { DeliveryStatus } from "@/modules/channels/messaging/types";
import { hmacBase64, timingSafeEqual } from "@/modules/channels/messaging/crypto";

function channelTypeFrom(value: string): "sms" | "whatsapp" {
  return value.startsWith("whatsapp:") ? "whatsapp" : "sms";
}

function stripScheme(value: string): string {
  return value.replace(/^whatsapp:/, "").trim();
}

const STATUS_MAP: Record<string, DeliveryStatus> = {
  queued: "queued",
  sending: "sent",
  sent: "sent",
  delivered: "delivered",
  read: "read",
  undelivered: "undelivered",
  failed: "failed",
};

export const twilioProvider: MessagingProvider = {
  providerType: "twilio",
  displayName: "Twilio",
  supportedChannelTypes: ["sms", "whatsapp"],

  parseInboundWebhook(request: WebhookRequest): MessagingInboundMessage | null {
    const form = request.form;
    const from = form.From ?? "";
    const body = form.Body ?? "";
    // A delivery callback carries a status, not a body — not an inbound message.
    if (!from || (form.MessageStatus ?? form.SmsStatus)) return null;
    if (!body.trim()) return null;
    const channelType = channelTypeFrom(from);
    return {
      providerType: "twilio",
      channelType,
      externalConversationId: from,
      externalMessageId: form.MessageSid ?? form.SmsMessageSid ?? "",
      senderExternalId: stripScheme(from),
      senderLabel: null,
      messageText: body,
      contentType: "text",
      receivedAt: null,
      metadata: { to: form.To ?? null },
    };
  },

  parseDeliveryStatus(request: WebhookRequest): MessagingDeliveryEvent | null {
    const form = request.form;
    const status = form.MessageStatus ?? form.SmsStatus;
    const sid = form.MessageSid ?? form.SmsSid;
    if (!status || !sid) return null;
    return {
      providerType: "twilio",
      externalMessageId: sid,
      deliveryStatus: STATUS_MAP[status.toLowerCase()] ?? "sent",
      timestamp: null,
      metadata: {},
    };
  },

  async verifyWebhook(
    request: WebhookRequest,
    config: MessagingProviderConfig,
  ): Promise<VerifyResult> {
    const authToken = config.secrets.authToken;
    if (!authToken) return { verified: false, reason: "not_configured" };
    const signature = request.headers["x-twilio-signature"];
    if (!signature) return { verified: false, reason: "missing_signature" };
    // data = full URL + each POST param (sorted by key) concatenated as key+value.
    const sortedKeys = Object.keys(request.form).sort();
    const data = sortedKeys.reduce((acc, k) => acc + k + request.form[k], request.url);
    const expected = await hmacBase64("SHA-1", authToken, data);
    return {
      verified: timingSafeEqual(expected, signature),
      reason: "signature_checked",
    };
  },

  async sendMessage(
    request: MessagingOutboundRequest,
    config: MessagingProviderConfig,
  ): Promise<ProviderSendResult> {
    const { accountSid, authToken } = config.secrets;
    const messagingServiceSid = config.secrets.messagingServiceSid;
    const fromNumber = String(config.channelConfig.senderId ?? "");
    if (!accountSid || !authToken) {
      return { status: "simulated", externalMessageId: null, errorCode: null };
    }

    const prefix = request.channelType === "whatsapp" ? "whatsapp:" : "";
    const params = new URLSearchParams({
      To: `${prefix}${request.recipientExternalId}`,
      Body: request.messageText,
    });
    if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
    else params.set("From", `${prefix}${fromNumber}`);

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded",
            authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          },
          body: params.toString(),
        },
      );
      if (!res.ok)
        return { status: "failed", externalMessageId: null, errorCode: `http_${res.status}` };
      const data = (await res.json()) as { sid?: string };
      return { status: "sent", externalMessageId: data.sid ?? null, errorCode: null };
    } catch {
      return { status: "failed", externalMessageId: null, errorCode: "network_error" };
    }
  },

  getProviderStatus(config: MessagingProviderConfig): {
    mode: "live" | "simulated" | "unavailable";
  } {
    if (config.secrets.accountSid && config.secrets.authToken) return { mode: "live" };
    return { mode: "simulated" };
  },

  isEnvConfigured(): boolean {
    return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  },
};
