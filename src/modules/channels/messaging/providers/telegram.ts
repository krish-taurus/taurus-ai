/**
 * Telegram messaging provider (Sprint 036).
 *
 * The lowest-friction real channel: the owner creates a bot with @BotFather and
 * pastes the bot token. We register a webhook (setWebhook) with an optional
 * secret token; Telegram then POSTs each Update as JSON. Inbound text messages
 * are parsed here; replies go out via the Bot API sendMessage endpoint. Real
 * network calls happen only with a bot token — never in tests or local dev.
 *
 * Verification: Telegram echoes the secret configured at setWebhook time in the
 * `X-Telegram-Bot-Api-Secret-Token` header. When a secret is configured we
 * require it to match; when it is not, the unguessable webhook URL (the channel
 * public key) is the shared secret, as with Telegram bots that omit the token.
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
import { timingSafeEqual } from "@/modules/channels/messaging/crypto";

const TELEGRAM_API_BASE = "https://api.telegram.org";

interface TelegramUpdate {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}
interface TelegramMessage {
  message_id?: number;
  from?: { id?: number; first_name?: string; username?: string };
  chat?: { id?: number; type?: string };
  date?: number;
  text?: string;
}

export const telegramProvider: MessagingProvider = {
  providerType: "telegram",
  displayName: "Telegram",
  supportedChannelTypes: ["telegram"],

  parseInboundWebhook(request: WebhookRequest): MessagingInboundMessage | null {
    const update = (request.json ?? null) as TelegramUpdate | null;
    // Only handle fresh text messages; ignore edits, joins, callbacks, etc.
    const message = update?.message;
    const text = message?.text?.trim();
    const chatId = message?.chat?.id;
    if (!message || !text || chatId === undefined || chatId === null) return null;

    const from = message.from ?? {};
    const label = from.first_name || from.username || null;
    return {
      providerType: "telegram",
      channelType: "telegram",
      externalConversationId: String(chatId),
      externalMessageId: message.message_id !== undefined ? String(message.message_id) : "",
      // We reply to the chat id (works for both 1:1 and group chats).
      senderExternalId: String(chatId),
      senderLabel: label,
      messageText: text,
      contentType: "text",
      receivedAt: message.date ? new Date(message.date * 1000).toISOString() : null,
      metadata: {
        fromId: from.id ?? null,
        username: from.username ?? null,
        chatType: message.chat?.type ?? null,
      },
    };
  },

  parseDeliveryStatus(): MessagingDeliveryEvent | null {
    // Telegram does not send delivery receipts to the bot.
    return null;
  },

  async verifyWebhook(
    request: WebhookRequest,
    config: MessagingProviderConfig,
  ): Promise<VerifyResult> {
    const expected = config.secrets.webhookSecret;
    const provided = request.headers["x-telegram-bot-api-secret-token"];
    // No secret configured → the unguessable webhook URL is the shared secret.
    if (!expected) return { verified: true, reason: "no_secret_configured" };
    if (!provided) return { verified: false, reason: "missing_secret" };
    return { verified: timingSafeEqual(expected, provided), reason: "secret_checked" };
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
      const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: request.recipientExternalId, text: request.messageText }),
      });
      if (!res.ok) {
        return { status: "failed", externalMessageId: null, errorCode: `http_${res.status}` };
      }
      const data = (await res.json()) as { ok?: boolean; result?: { message_id?: number } };
      if (!data.ok) return { status: "failed", externalMessageId: null, errorCode: "telegram_error" };
      const id = data.result?.message_id;
      return { status: "sent", externalMessageId: id !== undefined ? String(id) : null, errorCode: null };
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
    return !!process.env.TELEGRAM_BOT_TOKEN;
  },
};
