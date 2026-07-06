/**
 * Voice provider abstraction (Prompt 010).
 *
 * A common interface every voice (telephony) provider implements. Provider-
 * specific call parsing / signing / response payloads stay inside the adapters;
 * the voice runtime works only with these normalized shapes and never imports a
 * provider SDK. Reasoning is delegated to the Employee Chat Runtime.
 */

import type { ChannelProviderType, VoiceCallStatus } from "@/lib/db/types";
import type { WebhookRequest } from "@/modules/channels/messaging/types";

/** A normalized inbound call. `callerExternalId` is hashed by the runtime. */
export interface NormalizedInboundCall {
  providerType: ChannelProviderType;
  externalCallId: string;
  direction: "inbound" | "outbound";
  callerExternalId: string;
  callerLabel: string | null;
  toNumber: string | null;
  metadata: Record<string, unknown>;
}

export interface NormalizedCallStatus {
  externalCallId: string;
  status: VoiceCallStatus;
  metadata: Record<string, unknown>;
}

/** The response payload returned to the provider (internal; never shown to users). */
export interface VoiceCallResponse {
  contentType: string;
  body: string;
}

export type VoiceProviderMode = "live" | "simulated" | "unavailable";

export interface VoiceProviderConfig {
  mode: VoiceProviderMode;
  /** Decrypted secrets (server-only). Empty in simulated mode. */
  secrets: Record<string, string>;
  channelConfig: Record<string, unknown>;
}

export interface VoiceVerifyResult {
  verified: boolean;
  reason: string;
}

export interface CreateCallResponseInput {
  greeting: string;
  streamUrl?: string | null;
  config: VoiceProviderConfig;
}

export interface VoiceProvider {
  providerType: ChannelProviderType;
  displayName: string;
  parseInboundCallWebhook(request: WebhookRequest): NormalizedInboundCall | null;
  parseCallStatusWebhook(request: WebhookRequest): NormalizedCallStatus | null;
  verifyWebhook(request: WebhookRequest, config: VoiceProviderConfig): Promise<VoiceVerifyResult>;
  createCallResponse(input: CreateCallResponseInput): VoiceCallResponse;
  startMediaStream(request: {
    callSessionId: string;
    streamUrl: string;
  }): Promise<{ streamId: string }>;
  stopMediaStream(streamId: string): Promise<void>;
  getProviderStatus(config: VoiceProviderConfig): { mode: VoiceProviderMode };
  isEnvConfigured(): boolean;
}

/** Escape text for safe inclusion in an XML/JSON call response payload. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
