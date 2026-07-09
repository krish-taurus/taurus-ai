/**
 * Meta Messenger + Instagram DM provider (Sprint 042).
 *
 * Messenger and Instagram messaging share the same shape: a Meta webhook object
 * with entry[].messaging[] events, X-Hub-Signature-256 request verification, the
 * hub.challenge GET handshake, and outbound sends via the Graph API
 * /me/messages. One factory serves both — only the webhook object name and the
 * channel/provider identity differ. Real network calls happen only with a Page
 * access token; echoes from the page itself are ignored to avoid reply loops.
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
import type { ChannelProviderType, ChannelType } from "@/lib/db/types";
import { hmacHex, timingSafeEqual } from "@/modules/channels/messaging/crypto";

const GRAPH_VERSION = "v20.0";

interface MetaMessagingEvent {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean };
  delivery?: unknown;
  read?: unknown;
}

function firstEvent(json: unknown): MetaMessagingEvent | null {
  const j = json as { entry?: Array<{ messaging?: MetaMessagingEvent[] }> };
  return j?.entry?.[0]?.messaging?.[0] ?? null;
}

function createMetaMessagingProvider(opts: {
  providerType: ChannelProviderType;
  channelType: ChannelType;
  displayName: string;
}): MessagingProvider {
  const { providerType, channelType, displayName } = opts;
  return {
    providerType,
    displayName,
    supportedChannelTypes: [channelType],

    parseInboundWebhook(request: WebhookRequest): MessagingInboundMessage | null {
      const event = firstEvent(request.json);
      const message = event?.message;
      const from = event?.sender?.id;
      // Ignore delivery/read events and the page's own echoes (loop guard).
      if (!message || message.is_echo || !from) return null;
      const text = message.text?.trim();
      if (!text) return null;
      return {
        providerType,
        channelType,
        externalConversationId: from,
        externalMessageId: message.mid ?? "",
        senderExternalId: from,
        senderLabel: null,
        messageText: text,
        contentType: "text",
        receivedAt: event?.timestamp ? new Date(event.timestamp).toISOString() : null,
        metadata: { recipientId: event?.recipient?.id ?? null },
      };
    },

    parseDeliveryStatus(request: WebhookRequest): MessagingDeliveryEvent | null {
      const event = firstEvent(request.json);
      if (!event) return null;
      if (event.delivery) {
        return { providerType, externalMessageId: "", deliveryStatus: "delivered", timestamp: null, metadata: {} };
      }
      if (event.read) {
        return { providerType, externalMessageId: "", deliveryStatus: "read", timestamp: null, metadata: {} };
      }
      return null;
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
      if (!accessToken) {
        return { status: "simulated", externalMessageId: null, errorCode: null };
      }
      try {
        const res = await fetch(
          `https://graph.facebook.com/${GRAPH_VERSION}/me/messages?access_token=${encodeURIComponent(accessToken)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              recipient: { id: request.recipientExternalId },
              messaging_type: "RESPONSE",
              message: { text: request.messageText },
            }),
          },
        );
        if (!res.ok)
          return { status: "failed", externalMessageId: null, errorCode: `http_${res.status}` };
        const data = (await res.json()) as { message_id?: string };
        return { status: "sent", externalMessageId: data.message_id ?? null, errorCode: null };
      } catch {
        return { status: "failed", externalMessageId: null, errorCode: "network_error" };
      }
    },

    getProviderStatus(config: MessagingProviderConfig): {
      mode: "live" | "simulated" | "unavailable";
    } {
      return config.secrets.accessToken ? { mode: "live" } : { mode: "simulated" };
    },

    isEnvConfigured(): boolean {
      // Page tokens are per-connection (BYOK / OAuth), never global env.
      return false;
    },
  };
}

export const messengerProvider = createMetaMessagingProvider({
  providerType: "meta_messenger",
  channelType: "facebook_messenger",
  displayName: "Facebook Messenger",
});

export const instagramProvider = createMetaMessagingProvider({
  providerType: "meta_instagram",
  channelType: "instagram_dm",
  displayName: "Instagram DM",
});
