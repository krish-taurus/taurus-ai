/**
 * Twilio voice provider (Prompt 010) — foundation.
 *
 * Parses Twilio's form-encoded inbound call + status callbacks, verifies the
 * X-Twilio-Signature when an auth token is configured, and generates a voice
 * response payload with a spoken greeting (and an optional audio-stream connect
 * for a future sprint). No real outbound calls are made in this sprint.
 */

import type { WebhookRequest } from "@/modules/channels/messaging/types";
import { hmacBase64, timingSafeEqual } from "@/modules/channels/messaging/crypto";
import type {
  CreateCallResponseInput,
  NormalizedCallStatus,
  NormalizedInboundCall,
  VoiceCallResponse,
  VoiceProvider,
  VoiceProviderConfig,
  VoiceVerifyResult,
} from "@/modules/voice-runtime/types";
import { escapeXml } from "@/modules/voice-runtime/types";
import type { VoiceCallStatus } from "@/lib/db/types";

const FINAL_STATUSES = new Set(["completed", "busy", "failed", "no-answer", "canceled"]);
const STATUS_MAP: Record<string, VoiceCallStatus> = {
  ringing: "ringing",
  "in-progress": "active",
  completed: "completed",
  busy: "failed",
  failed: "failed",
  "no-answer": "missed",
  canceled: "missed",
};

export const twilioVoiceProvider: VoiceProvider = {
  providerType: "twilio_voice",
  displayName: "Twilio",

  parseInboundCallWebhook(request: WebhookRequest): NormalizedInboundCall | null {
    const form = request.form;
    const from = form.From ?? "";
    const callSid = form.CallSid ?? "";
    const status = (form.CallStatus ?? "").toLowerCase();
    // A final status callback is not a new inbound call.
    if (!from || !callSid || FINAL_STATUSES.has(status)) return null;
    return {
      providerType: "twilio_voice",
      externalCallId: callSid,
      direction: "inbound",
      callerExternalId: from,
      callerLabel: form.CallerName ?? null,
      toNumber: form.To ?? null,
      metadata: {},
    };
  },

  parseCallStatusWebhook(request: WebhookRequest): NormalizedCallStatus | null {
    const form = request.form;
    const status = (form.CallStatus ?? "").toLowerCase();
    const sid = form.CallSid ?? "";
    if (!status || !sid || !FINAL_STATUSES.has(status)) return null;
    return {
      externalCallId: sid,
      status: STATUS_MAP[status] ?? "completed",
      metadata: {},
    };
  },

  async verifyWebhook(
    request: WebhookRequest,
    config: VoiceProviderConfig,
  ): Promise<VoiceVerifyResult> {
    const authToken = config.secrets.authToken;
    if (!authToken) return { verified: false, reason: "not_configured" };
    const signature = request.headers["x-twilio-signature"];
    if (!signature) return { verified: false, reason: "missing_signature" };
    const sortedKeys = Object.keys(request.form).sort();
    const data = sortedKeys.reduce((acc, k) => acc + k + request.form[k], request.url);
    const expected = await hmacBase64("SHA-1", authToken, data);
    return { verified: timingSafeEqual(expected, signature), reason: "signature_checked" };
  },

  createCallResponse(input: CreateCallResponseInput): VoiceCallResponse {
    const say = `<Say>${escapeXml(input.greeting)}</Say>`;
    // The audio-stream connect is foundation only (used by a future sprint).
    const connect = input.streamUrl
      ? `<Connect><Stream url="${escapeXml(input.streamUrl)}"/></Connect>`
      : "";
    return {
      contentType: "text/xml",
      body: `<?xml version="1.0" encoding="UTF-8"?><Response>${say}${connect}</Response>`,
    };
  },

  async startMediaStream(): Promise<{ streamId: string }> {
    return { streamId: `tw_stream_${globalThis.crypto.randomUUID().slice(0, 12)}` };
  },
  async stopMediaStream(): Promise<void> {
    /* no-op foundation */
  },

  getProviderStatus(config: VoiceProviderConfig): { mode: "live" | "simulated" | "unavailable" } {
    return { mode: config.secrets.accountSid && config.secrets.authToken ? "live" : "simulated" };
  },
  isEnvConfigured(): boolean {
    return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  },
};
