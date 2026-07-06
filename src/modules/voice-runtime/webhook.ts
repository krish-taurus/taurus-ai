/**
 * Voice webhook processing (Prompt 010) — server only.
 *
 * Provider-agnostic inbound-call handler: resolves the channel from the URL
 * public key (never client-supplied org), verifies the provider signature when
 * configured, routes call-status vs inbound calls, creates/updates the call
 * session, and returns a provider-appropriate response (or a safe fallback).
 * Errors are metadata-only and never leak secrets.
 */

import type { DataStore } from "@/lib/db/store";
import type { ChatGateway } from "@/modules/employee-chat/service";
import { isProductionRuntime } from "@/modules/model-gateway/credential-resolver";
import { getVoiceProvider, VOICE_WEBHOOK_PROVIDER_SLUGS } from "@/modules/voice-runtime/providers";
import { resolveVoiceProviderConfig } from "@/modules/voice-runtime/config";
import { startVoiceCall } from "@/modules/voice-runtime/runtime";
import type { WebhookRequest } from "@/modules/channels/messaging/types";

export interface VoiceWebhookDeps {
  store: DataStore;
  gateway: ChatGateway;
  isProduction?: () => boolean;
}

export interface VoiceWebhookResult {
  status: number;
  body: string;
  contentType?: string;
}

const FALLBACK_BODY = "This line isn't available right now.";

export async function processVoiceWebhook(
  deps: VoiceWebhookDeps,
  params: { providerSlug: string; publicKey: string; request: WebhookRequest },
): Promise<VoiceWebhookResult> {
  const { store } = deps;
  const isProduction = deps.isProduction ?? isProductionRuntime;

  const providerType = VOICE_WEBHOOK_PROVIDER_SLUGS[params.providerSlug];
  const provider = providerType ? getVoiceProvider(providerType) : null;
  if (!providerType || !provider) return { status: 404, body: "Not found" };

  const channel = await store.getEmployeeChannelByPublicKey(params.publicKey);
  if (!channel || channel.channelProvider !== providerType) {
    await store.createVoiceStreamEvent({
      organizationId: null,
      channelId: null,
      providerType,
      eventType: "call.webhook_received",
      status: "ignored",
      metadata: { reason: "unknown_channel" },
    });
    return { status: 404, body: "Not found" };
  }

  const config = await resolveVoiceProviderConfig(store, channel, provider);

  // --- Signature verification ---------------------------------------------
  const verify = await provider.verifyWebhook(params.request, config);
  const allowed = verify.verified || (config.mode !== "live" && !isProduction());
  if (!allowed) {
    await store.createVoiceStreamEvent({
      organizationId: channel.organizationId,
      channelId: channel.id,
      providerType,
      eventType: "call.failed",
      status: "failed",
      metadata: { reason: "unverified" },
    });
    return { status: 401, body: "Unauthorized" };
  }

  // --- Call status callbacks ----------------------------------------------
  const statusEvent = provider.parseCallStatusWebhook(params.request);
  if (statusEvent) {
    const session = await store.getVoiceCallSessionByExternalId(
      providerType,
      statusEvent.externalCallId,
    );
    if (session && session.organizationId === channel.organizationId) {
      if (statusEvent.status === "completed" || statusEvent.status === "failed") {
        await store.endVoiceCallSession(channel.organizationId, session.id, statusEvent.status);
      } else {
        await store.updateVoiceCallSessionStatus(channel.organizationId, session.id, {
          status: statusEvent.status,
        });
      }
      await store.createVoiceStreamEvent({
        organizationId: channel.organizationId,
        channelId: channel.id,
        callSessionId: session.id,
        providerType,
        eventType: "call.ended",
        metadata: { status: statusEvent.status },
      });
    }
    return { status: 200, body: "" };
  }

  // --- Inbound call --------------------------------------------------------
  const inboundCall = provider.parseInboundCallWebhook(params.request);
  if (!inboundCall) {
    // Nothing actionable — safe fallback response.
    const fallback = provider.createCallResponse({ greeting: FALLBACK_BODY, config });
    return { status: 200, body: fallback.body, contentType: fallback.contentType };
  }

  const numbers = inboundCall.toNumber
    ? await store.listVoicePhoneNumbersForChannel(channel.organizationId, channel.id)
    : [];
  const phoneNumber = numbers.find((n) => n.phoneNumber === inboundCall.toNumber) ?? numbers[0];

  const result = await startVoiceCall(deps, {
    channel,
    provider,
    config,
    inboundCall,
    phoneNumberId: phoneNumber?.id ?? null,
  });
  return { status: 200, body: result.response.body, contentType: result.response.contentType };
}
