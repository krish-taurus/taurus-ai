/**
 * Meta WhatsApp Cloud API provider (Prompt 009) — WhatsApp foundation.
 *
 * Parses the Cloud API inbound + delivery payloads, verifies the
 * X-Hub-Signature-256 when an app secret is configured, handles the GET
 * verification challenge, and sends via the Graph API when live. No marketing
 * broadcasts, no template submission — inbound/reply foundation only.
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
import { hmacHex, timingSafeEqual } from "@/modules/channels/messaging/crypto";

interface MetaValue {
  messages?: Array<{ from?: string; id?: string; text?: { body?: string }; type?: string }>;
  statuses?: Array<{ id?: string; status?: string; recipient_id?: string; timestamp?: string }>;
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
}

function firstValue(json: unknown): MetaValue | null {
  const j = json as { entry?: Array<{ changes?: Array<{ value?: MetaValue }> }> };
  return j?.entry?.[0]?.changes?.[0]?.value ?? null;
}

const STATUS_MAP: Record<string, DeliveryStatus> = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
};

/** Handle the Meta GET verification challenge. Returns the challenge or null. */
export function metaVerifyChallenge(
  query: Record<string, string>,
  verifyToken: string | undefined,
): string | null {
  if (!verifyToken) return null;
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];
  if (mode === "subscribe" && token && timingSafeEqual(token, verifyToken)) {
    return challenge ?? "";
  }
  return null;
}

export const metaWhatsAppProvider: MessagingProvider = {
  providerType: "meta_whatsapp_cloud",
  displayName: "Meta WhatsApp Cloud",
  supportedChannelTypes: ["whatsapp"],

  parseInboundWebhook(request: WebhookRequest): MessagingInboundMessage | null {
    const value = firstValue(request.json);
    const message = value?.messages?.[0];
    if (!message || !message.from) return null;
    const text = message.text?.body ?? "";
    if (!text.trim()) return null;
    const contact = value?.contacts?.[0];
    return {
      providerType: "meta_whatsapp_cloud",
      channelType: "whatsapp",
      externalConversationId: message.from,
      externalMessageId: message.id ?? "",
      senderExternalId: message.from,
      senderLabel: contact?.profile?.name ?? null,
      messageText: text,
      contentType: "text",
      receivedAt: null,
      metadata: {},
    };
  },

  parseDeliveryStatus(request: WebhookRequest): MessagingDeliveryEvent | null {
    const status = firstValue(request.json)?.statuses?.[0];
    if (!status || !status.id || !status.status) return null;
    return {
      providerType: "meta_whatsapp_cloud",
      externalMessageId: status.id,
      deliveryStatus: STATUS_MAP[status.status] ?? "sent",
      timestamp: status.timestamp ?? null,
      metadata: {},
    };
  },

  async verifyWebhook(
    request: WebhookRequest,
    config: MessagingProviderConfig,
  ): Promise<VerifyResult> {
    const appSecret = config.secrets.appSecret;
    if (!appSecret) return { verified: false, reason: "not_configured" };
    const header = request.headers["x-hub-signature-256"] ?? "";
    const expected = `sha256=${await hmacHex("SHA-256", appSecret, request.rawBody)}`;
    return { verified: timingSafeEqual(expected, header), reason: "signature_checked" };
  },

  async sendMessage(
    request: MessagingOutboundRequest,
    config: MessagingProviderConfig,
  ): Promise<ProviderSendResult> {
    const accessToken = config.secrets.accessToken;
    const phoneNumberId =
      config.secrets.phoneNumberId ?? String(config.channelConfig.senderId ?? "");
    if (!accessToken || !phoneNumberId) {
      return { status: "simulated", externalMessageId: null, errorCode: null };
    }
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: request.recipientExternalId,
          type: "text",
          text: { body: request.messageText },
        }),
      });
      if (!res.ok)
        return { status: "failed", externalMessageId: null, errorCode: `http_${res.status}` };
      const data = (await res.json()) as { messages?: Array<{ id?: string }> };
      return { status: "sent", externalMessageId: data.messages?.[0]?.id ?? null, errorCode: null };
    } catch {
      return { status: "failed", externalMessageId: null, errorCode: "network_error" };
    }
  },

  getProviderStatus(config: MessagingProviderConfig): {
    mode: "live" | "simulated" | "unavailable";
  } {
    if (
      config.secrets.accessToken &&
      (config.secrets.phoneNumberId || config.channelConfig.senderId)
    ) {
      return { mode: "live" };
    }
    return { mode: "simulated" };
  },

  isEnvConfigured(): boolean {
    return !!(process.env.META_WHATSAPP_ACCESS_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID);
  },
};
