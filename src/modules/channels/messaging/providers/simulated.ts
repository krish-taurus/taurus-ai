/**
 * Simulated messaging provider (Prompt 009).
 *
 * Used for local development, tests, and the dashboard "Simulate incoming
 * message" panel. Never touches the network. Also backs the custom_webhook
 * provider as a generic passthrough foundation.
 */

import type { ChannelProviderType, ChannelType } from "@/lib/db/types";
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

function simId(prefix: string): string {
  return `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function createSimulatedProvider(
  providerType: ChannelProviderType,
  channelType: ChannelType,
  displayName: string,
): MessagingProvider {
  return {
    providerType,
    displayName,
    supportedChannelTypes: [channelType],

    parseInboundWebhook(request: WebhookRequest): MessagingInboundMessage | null {
      const body = (request.json ?? {}) as Record<string, unknown>;
      const from = String(body.from ?? request.form.from ?? "").trim();
      const text = String(body.text ?? body.message ?? request.form.text ?? "").trim();
      if (!from || !text) return null;
      return {
        providerType,
        channelType,
        externalConversationId: String(body.conversationId ?? from),
        externalMessageId: simId("sim_in"),
        senderExternalId: from,
        senderLabel: typeof body.name === "string" ? body.name : null,
        messageText: text,
        contentType: channelType === "email" ? "email" : "text",
        receivedAt: null,
        metadata: { simulated: true },
      };
    },

    parseDeliveryStatus(request: WebhookRequest): MessagingDeliveryEvent | null {
      const body = (request.json ?? {}) as Record<string, unknown>;
      if (!body.deliveryStatus || !body.externalMessageId) return null;
      return {
        providerType,
        externalMessageId: String(body.externalMessageId),
        deliveryStatus: "delivered",
        timestamp: null,
        metadata: { simulated: true },
      };
    },

    async verifyWebhook(): Promise<VerifyResult> {
      return { verified: true, reason: "simulated" };
    },

    async sendMessage(_request: MessagingOutboundRequest): Promise<ProviderSendResult> {
      void _request;
      // No network — record a simulated send.
      return { status: "simulated", externalMessageId: simId("sim_out"), errorCode: null };
    },

    getProviderStatus(_config: MessagingProviderConfig): { mode: "simulated" } {
      void _config;
      return { mode: "simulated" };
    },

    isEnvConfigured(): boolean {
      return true;
    },
  };
}
