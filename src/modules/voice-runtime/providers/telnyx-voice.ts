/**
 * Telnyx voice provider (Prompt 010) — foundation.
 *
 * Parses Telnyx Call Control JSON webhooks (call.initiated + status events) and
 * returns a JSON call-response payload. Signature verification is foundation
 * (accepted when a public key is configured; full Ed25519 verification is a later
 * sprint). No real outbound calls in this sprint.
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

interface TelnyxPayload {
  call_control_id?: string;
  from?: string;
  to?: string;
  direction?: string;
  state?: string;
  hangup_cause?: string;
}

function eventData(json: unknown): { eventType: string; payload: TelnyxPayload } | null {
  const data = (json as { data?: { event_type?: string; payload?: TelnyxPayload } })?.data;
  if (!data?.event_type) return null;
  return { eventType: data.event_type, payload: data.payload ?? {} };
}

const STATUS_MAP: Record<string, VoiceCallStatus> = {
  "call.hangup": "completed",
  "call.answered": "active",
  "call.initiated": "ringing",
};

export const telnyxVoiceProvider: VoiceProvider = {
  providerType: "telnyx_voice",
  displayName: "Telnyx",

  parseInboundCallWebhook(request: WebhookRequest): NormalizedInboundCall | null {
    const ev = eventData(request.json);
    if (!ev || ev.eventType !== "call.initiated") return null;
    const p = ev.payload;
    if (!p.call_control_id || !p.from) return null;
    if (p.direction && p.direction !== "incoming") return null;
    return {
      providerType: "telnyx_voice",
      externalCallId: p.call_control_id,
      direction: "inbound",
      callerExternalId: p.from,
      callerLabel: null,
      toNumber: p.to ?? null,
      metadata: {},
    };
  },

  parseCallStatusWebhook(request: WebhookRequest): NormalizedCallStatus | null {
    const ev = eventData(request.json);
    if (!ev || ev.eventType === "call.initiated") return null;
    const p = ev.payload;
    if (!p.call_control_id) return null;
    return {
      externalCallId: p.call_control_id,
      status: STATUS_MAP[ev.eventType] ?? "completed",
      metadata: {},
    };
  },

  async verifyWebhook(
    _request: WebhookRequest,
    config: VoiceProviderConfig,
  ): Promise<VoiceVerifyResult> {
    void _request;
    // Foundation: full Ed25519 signature verification lands in a later sprint.
    if (!config.secrets.publicKey) return { verified: false, reason: "not_configured" };
    return { verified: true, reason: "foundation" };
  },

  createCallResponse(input: CreateCallResponseInput): VoiceCallResponse {
    // Telnyx uses Call Control commands; foundation returns a simple ack payload.
    return {
      contentType: "application/json",
      body: JSON.stringify({ instruction: "speak", text: input.greeting }),
    };
  },

  async startMediaStream(): Promise<{ streamId: string }> {
    return { streamId: `tx_stream_${globalThis.crypto.randomUUID().slice(0, 12)}` };
  },
  async stopMediaStream(): Promise<void> {
    /* no-op foundation */
  },

  getProviderStatus(config: VoiceProviderConfig): { mode: "live" | "simulated" | "unavailable" } {
    return { mode: config.secrets.apiKey ? "live" : "simulated" };
  },
  isEnvConfigured(): boolean {
    return !!process.env.TELNYX_API_KEY;
  },
};
