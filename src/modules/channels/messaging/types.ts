/**
 * Messaging provider abstraction (Prompt 009).
 *
 * A common interface every messaging provider (Twilio, Meta WhatsApp Cloud,
 * SendGrid, Mailgun, simulated) implements. Provider-specific parsing / signing /
 * sending stays inside the adapters; the channel runtime works only with these
 * normalized shapes and never imports a provider SDK.
 */

import type { ChannelProviderType, ChannelType } from "@/lib/db/types";

/** A normalized view of an inbound HTTP webhook request. */
export interface WebhookRequest {
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  rawBody: string;
  /** Parsed application/x-www-form-urlencoded or multipart form fields. */
  form: Record<string, string>;
  /** Parsed JSON body, if the content-type was JSON. */
  json: unknown | null;
}

/** A provider-agnostic inbound message (normalized). */
export interface MessagingInboundMessage {
  providerType: ChannelProviderType;
  channelType: ChannelType;
  externalConversationId: string;
  externalMessageId: string;
  senderExternalId: string;
  senderLabel: string | null;
  messageText: string;
  contentType: "text" | "email" | "other";
  receivedAt: string | null;
  metadata: Record<string, unknown>;
}

/** A provider-agnostic outbound send request (normalized). */
export interface MessagingOutboundRequest {
  providerType: ChannelProviderType;
  channelType: ChannelType;
  recipientExternalId: string;
  messageText: string;
  conversationId: string;
  channelId: string;
  metadata: Record<string, unknown>;
}

export type DeliveryStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "undelivered";

/** A provider-agnostic delivery/status callback (normalized). */
export interface MessagingDeliveryEvent {
  providerType: ChannelProviderType;
  externalMessageId: string;
  deliveryStatus: DeliveryStatus;
  timestamp: string | null;
  metadata: Record<string, unknown>;
}

export type ProviderMode = "live" | "simulated" | "unavailable";

/** Resolved config for a provider call. Secrets are server-only, never returned. */
export interface MessagingProviderConfig {
  mode: ProviderMode;
  /** Decrypted secrets (server-only). Empty in simulated mode. */
  secrets: Record<string, string>;
  /** Non-secret channel provider config (sender id, etc.). */
  channelConfig: Record<string, unknown>;
}

export interface VerifyResult {
  verified: boolean;
  reason: string;
}

export interface ProviderSendResult {
  status: "sent" | "failed" | "simulated";
  externalMessageId: string | null;
  errorCode: string | null;
}

/** Common messaging provider interface. */
export interface MessagingProvider {
  providerType: ChannelProviderType;
  displayName: string;
  supportedChannelTypes: ChannelType[];
  parseInboundWebhook(request: WebhookRequest): MessagingInboundMessage | null;
  parseDeliveryStatus(request: WebhookRequest): MessagingDeliveryEvent | null;
  verifyWebhook(request: WebhookRequest, config: MessagingProviderConfig): Promise<VerifyResult>;
  sendMessage(
    request: MessagingOutboundRequest,
    config: MessagingProviderConfig,
  ): Promise<ProviderSendResult>;
  getProviderStatus(config: MessagingProviderConfig): { mode: ProviderMode };
  /** Whether platform-level env config exists for this provider (server-only). */
  isEnvConfigured(): boolean;
}
