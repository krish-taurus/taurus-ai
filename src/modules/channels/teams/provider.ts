/**
 * Microsoft Teams messaging provider (Sprint 043).
 *
 * Implements the shared MessagingProvider interface so the existing runtime is
 * reused. Teams is driven by its own webhook (JWT verification + tenant routing
 * live in the service); this adapter parses the Activity and replies via the Bot
 * Connector using the serviceUrl stashed on the connection. Real network calls
 * happen only with an app id + password.
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
import { parseActivity, getConnectorToken, sendReply } from "@/modules/channels/teams/bot-framework";

export const teamsProvider: MessagingProvider = {
  providerType: "microsoft_graph",
  displayName: "Microsoft Teams",
  supportedChannelTypes: ["microsoft_teams"],

  parseInboundWebhook(request: WebhookRequest): MessagingInboundMessage | null {
    const activity = parseActivity(request.json);
    if (!activity) return null;
    return {
      providerType: "microsoft_graph",
      channelType: "microsoft_teams",
      externalConversationId: activity.conversationId,
      externalMessageId: activity.activityId,
      // We reply into the same Teams conversation.
      senderExternalId: activity.conversationId,
      senderLabel: activity.fromName,
      messageText: activity.text,
      contentType: "text",
      receivedAt: null,
      metadata: { tenantId: activity.tenantId, serviceUrl: activity.serviceUrl },
    };
  },

  parseDeliveryStatus(): MessagingDeliveryEvent | null {
    return null;
  },

  async verifyWebhook(): Promise<VerifyResult> {
    // JWT verification happens in the Teams service (it owns the JWKS cache).
    return { verified: true, reason: "verified_in_service" };
  },

  async sendMessage(
    request: MessagingOutboundRequest,
    config: MessagingProviderConfig,
  ): Promise<ProviderSendResult> {
    const appId = config.secrets.appId;
    const appPassword = config.secrets.appPassword;
    const serviceUrl = String(config.channelConfig.serviceUrl ?? "");
    if (!appId || !appPassword || !serviceUrl) {
      return { status: "simulated", externalMessageId: null, errorCode: null };
    }
    try {
      const token = await getConnectorToken(appId, appPassword);
      const result = await sendReply({
        serviceUrl,
        conversationId: request.recipientExternalId,
        text: request.messageText,
        token,
      });
      return {
        status: result.status,
        externalMessageId: result.id,
        errorCode: result.errorCode,
      };
    } catch {
      return { status: "failed", externalMessageId: null, errorCode: "auth_error" };
    }
  },

  getProviderStatus(config: MessagingProviderConfig): {
    mode: "live" | "simulated" | "unavailable";
  } {
    return config.secrets.appId && config.secrets.appPassword ? { mode: "live" } : { mode: "simulated" };
  },

  isEnvConfigured(): boolean {
    return !!(process.env.TEAMS_APP_ID && process.env.TEAMS_APP_PASSWORD);
  },
};
