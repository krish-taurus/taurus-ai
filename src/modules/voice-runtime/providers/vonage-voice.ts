/**
 * Vonage voice provider (Prompt 010) — placeholder.
 *
 * Minimal parsing + an NCCO-style JSON greeting response for UI/metadata support.
 * Real call execution lands in a later sprint. No external calls this sprint.
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
import type { VoiceCallStatus } from "@/lib/db/types";

const STATUS_MAP: Record<string, VoiceCallStatus> = {
  completed: "completed",
  answered: "active",
  ringing: "ringing",
  failed: "failed",
  rejected: "failed",
  unanswered: "missed",
};

export const vonageVoiceProvider: VoiceProvider = {
  providerType: "vonage_voice",
  displayName: "Vonage",

  parseInboundCallWebhook(request: WebhookRequest): NormalizedInboundCall | null {
    const body = (request.json ?? {}) as Record<string, unknown>;
    const from = String(body.from ?? "").trim();
    const uuid = String(body.uuid ?? body.conversation_uuid ?? "").trim();
    if (!from || !uuid || body.status) return null;
    return {
      providerType: "vonage_voice",
      externalCallId: uuid,
      direction: "inbound",
      callerExternalId: from,
      callerLabel: null,
      toNumber: typeof body.to === "string" ? body.to : null,
      metadata: {},
    };
  },

  parseCallStatusWebhook(request: WebhookRequest): NormalizedCallStatus | null {
    const body = (request.json ?? {}) as Record<string, unknown>;
    const status = String(body.status ?? "").toLowerCase();
    const uuid = String(body.uuid ?? "").trim();
    if (!status || !uuid) return null;
    return {
      externalCallId: uuid,
      status: STATUS_MAP[status] ?? "completed",
      metadata: {},
    };
  },

  async verifyWebhook(
    _request: WebhookRequest,
    config: VoiceProviderConfig,
  ): Promise<VoiceVerifyResult> {
    void _request;
    if (!config.secrets.apiSecret) return { verified: false, reason: "not_configured" };
    return { verified: true, reason: "foundation" };
  },

  createCallResponse(input: CreateCallResponseInput): VoiceCallResponse {
    return {
      contentType: "application/json",
      body: JSON.stringify([{ action: "talk", text: input.greeting }]),
    };
  },

  async startMediaStream(): Promise<{ streamId: string }> {
    return { streamId: `vg_stream_${globalThis.crypto.randomUUID().slice(0, 12)}` };
  },
  async stopMediaStream(): Promise<void> {
    /* no-op placeholder */
  },

  getProviderStatus(config: VoiceProviderConfig): { mode: "live" | "simulated" | "unavailable" } {
    return { mode: config.secrets.apiKey && config.secrets.apiSecret ? "live" : "simulated" };
  },
  isEnvConfigured(): boolean {
    return !!(process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET);
  },
};
