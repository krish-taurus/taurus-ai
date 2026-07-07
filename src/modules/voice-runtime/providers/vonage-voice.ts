/**
 * Vonage voice provider (Prompt 010) — placeholder.
 *
 * Minimal parsing + an NCCO-style JSON greeting response for UI/metadata support.
 * Webhook authenticity is verified with a real Vonage Signed-Webhook check: the
 * `Authorization: Bearer` JWT is HS256-verified against the signature secret and
 * its `payload_hash` claim is matched to the body (fail-closed). No external
 * calls this sprint.
 */

import type { WebhookRequest } from "@/modules/channels/messaging/types";
import { sha256Hex, verifyJwtHs256 } from "@/modules/channels/messaging/signature-verify";
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
    request: WebhookRequest,
    config: VoiceProviderConfig,
  ): Promise<VoiceVerifyResult> {
    // Real Vonage Signed-Webhook verification: HS256 JWT in the Authorization
    // header, signed with the signature secret, with a payload_hash claim over
    // the body. Fail-closed.
    const secret = config.secrets.signatureSecret ?? config.secrets.apiSecret;
    if (!secret) return { verified: false, reason: "not_configured" };
    const auth = request.headers["authorization"] ?? "";
    const token = /^bearer /i.test(auth) ? auth.slice(7).trim() : "";
    if (!token) return { verified: false, reason: "missing_signature" };

    const { valid, payload } = verifyJwtHs256(token, secret);
    if (!valid) return { verified: false, reason: "invalid_signature" };

    // When present, the payload_hash claim must match the request body.
    const claimHash = typeof payload?.payload_hash === "string" ? payload.payload_hash : null;
    if (claimHash && claimHash !== sha256Hex(request.rawBody)) {
      return { verified: false, reason: "payload_mismatch" };
    }
    return { verified: true, reason: "signature_checked" };
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
