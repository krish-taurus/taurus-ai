/**
 * Slack messaging provider (Sprint 038).
 *
 * Implements the shared MessagingProvider interface so the existing runtime
 * (inbound → AI → reply) is reused. Slack is driven by its own events webhook
 * (challenge handshake + team-id routing live there); this adapter parses the
 * event JSON, verifies the v0 request signature, and replies via chat.postMessage.
 * Real network calls happen only with a bot token.
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
import { verifySlackSignature } from "@/modules/channels/slack/oauth";

interface SlackEnvelope {
  type?: string;
  team_id?: string;
  event?: {
    type?: string;
    subtype?: string;
    channel?: string;
    user?: string;
    text?: string;
    ts?: string;
    bot_id?: string;
  };
}

export const slackProvider: MessagingProvider = {
  providerType: "slack",
  displayName: "Slack",
  supportedChannelTypes: ["slack"],

  parseInboundWebhook(request: WebhookRequest): MessagingInboundMessage | null {
    const body = (request.json ?? null) as SlackEnvelope | null;
    if (!body || body.type !== "event_callback") return null;
    const event = body.event;
    if (!event) return null;
    // Only human text messages / mentions — never other bots (avoids reply loops).
    if (event.type !== "message" && event.type !== "app_mention") return null;
    if (event.bot_id || event.subtype) return null;
    const text = event.text?.trim();
    const channel = event.channel;
    if (!text || !channel) return null;
    return {
      providerType: "slack",
      channelType: "slack",
      externalConversationId: channel,
      externalMessageId: event.ts ?? "",
      // We reply into the same Slack channel/DM the message came from.
      senderExternalId: channel,
      senderLabel: event.user ?? null,
      messageText: text,
      contentType: "text",
      receivedAt: event.ts ? new Date(Number(event.ts) * 1000).toISOString() : null,
      metadata: { teamId: body.team_id ?? null, slackUserId: event.user ?? null },
    };
  },

  parseDeliveryStatus(): MessagingDeliveryEvent | null {
    return null;
  },

  async verifyWebhook(
    request: WebhookRequest,
    config: MessagingProviderConfig,
  ): Promise<VerifyResult> {
    const signingSecret = config.secrets.signingSecret || process.env.SLACK_SIGNING_SECRET || "";
    if (!signingSecret) return { verified: false, reason: "not_configured" };
    const ok = verifySlackSignature({
      signingSecret,
      timestamp: request.headers["x-slack-request-timestamp"],
      signature: request.headers["x-slack-signature"],
      rawBody: request.rawBody,
    });
    return { verified: ok, reason: ok ? "signature_checked" : "bad_signature" };
  },

  async sendMessage(
    request: MessagingOutboundRequest,
    config: MessagingProviderConfig,
  ): Promise<ProviderSendResult> {
    const botToken = config.secrets.botToken;
    if (!botToken) {
      return { status: "simulated", externalMessageId: null, errorCode: null };
    }
    try {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
          authorization: `Bearer ${botToken}`,
        },
        body: JSON.stringify({ channel: request.recipientExternalId, text: request.messageText }),
      });
      const data = (await res.json()) as { ok?: boolean; ts?: string; error?: string };
      if (!data.ok) return { status: "failed", externalMessageId: null, errorCode: data.error ?? "slack_error" };
      return { status: "sent", externalMessageId: data.ts ?? null, errorCode: null };
    } catch {
      return { status: "failed", externalMessageId: null, errorCode: "network_error" };
    }
  },

  getProviderStatus(config: MessagingProviderConfig): {
    mode: "live" | "simulated" | "unavailable";
  } {
    return config.secrets.botToken ? { mode: "live" } : { mode: "simulated" };
  },

  isEnvConfigured(): boolean {
    return !!(process.env.SLACK_CLIENT_ID && process.env.SLACK_SIGNING_SECRET);
  },
};
