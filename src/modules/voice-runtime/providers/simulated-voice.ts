/**
 * Simulated voice provider (Prompt 010).
 *
 * Used for local dev, tests, and the "Simulate Phone Call" panel. Never touches
 * the network. Parses a simple JSON call payload and returns a plain-text
 * greeting response.
 */

import type { WebhookRequest } from "@/modules/channels/messaging/types";
import type {
  CreateCallResponseInput,
  NormalizedCallStatus,
  NormalizedInboundCall,
  VoiceCallResponse,
  VoiceProvider,
  VoiceProviderConfig,
  VoiceVerifyResult,
} from "@/modules/voice-runtime/types";

export const simulatedVoiceProvider: VoiceProvider = {
  providerType: "simulated_voice",
  displayName: "Simulated",

  parseInboundCallWebhook(request: WebhookRequest): NormalizedInboundCall | null {
    const body = (request.json ?? {}) as Record<string, unknown>;
    const from = String(body.from ?? request.form.from ?? "").trim();
    if (!from) return null;
    return {
      providerType: "simulated_voice",
      externalCallId: String(body.callId ?? `sim_call_${Date.now()}`),
      direction: "inbound",
      callerExternalId: from,
      callerLabel: typeof body.name === "string" ? body.name : null,
      toNumber: typeof body.to === "string" ? body.to : null,
      metadata: { simulated: true },
    };
  },

  parseCallStatusWebhook(request: WebhookRequest): NormalizedCallStatus | null {
    const body = (request.json ?? {}) as Record<string, unknown>;
    if (!body.callStatus || !body.callId) return null;
    return {
      externalCallId: String(body.callId),
      status: "completed",
      metadata: { simulated: true },
    };
  },

  async verifyWebhook(): Promise<VoiceVerifyResult> {
    return { verified: true, reason: "simulated" };
  },

  createCallResponse(input: CreateCallResponseInput): VoiceCallResponse {
    return { contentType: "text/plain", body: input.greeting };
  },

  async startMediaStream(): Promise<{ streamId: string }> {
    return { streamId: `sim_stream_${globalThis.crypto.randomUUID().slice(0, 12)}` };
  },
  async stopMediaStream(): Promise<void> {
    /* no-op */
  },

  getProviderStatus(_config: VoiceProviderConfig): { mode: "simulated" } {
    void _config;
    return { mode: "simulated" };
  },
  isEnvConfigured(): boolean {
    return true;
  },
};
