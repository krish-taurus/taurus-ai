/**
 * Messaging webhook processing (Prompt 009) — server only.
 *
 * Provider-agnostic webhook handler: resolves the channel from the URL public key
 * (never client-supplied org), verifies the provider signature when configured,
 * routes delivery-status vs inbound messages, and hands inbound messages to the
 * messaging runtime (which reuses the Employee Chat Runtime). Errors are
 * metadata-only and never leak secrets.
 */

import type { DataStore } from "@/lib/db/store";
import type { ChatGateway } from "@/modules/employee-chat/service";
import { isProductionRuntime } from "@/modules/model-gateway/credential-resolver";
import {
  getMessagingProvider,
  WEBHOOK_PROVIDER_SLUGS,
} from "@/modules/channels/messaging/registry";
import { resolveProviderConfig } from "@/modules/channels/messaging/config";
import { handleInboundMessagingMessage } from "@/modules/channels/messaging/runtime";
import type { WebhookRequest } from "@/modules/channels/messaging/types";

export interface WebhookDeps {
  store: DataStore;
  gateway: ChatGateway;
  isProduction?: () => boolean;
}

export interface WebhookResult {
  status: number;
  body: string;
  contentType?: string;
}

const OK: WebhookResult = { status: 200, body: "" };

export async function processMessagingWebhook(
  deps: WebhookDeps,
  params: { providerSlug: string; publicKey: string; request: WebhookRequest },
): Promise<WebhookResult> {
  const { store } = deps;
  const isProduction = deps.isProduction ?? isProductionRuntime;

  const providerType = WEBHOOK_PROVIDER_SLUGS[params.providerSlug];
  const provider = providerType ? getMessagingProvider(providerType) : null;
  if (!providerType || !provider) return { status: 404, body: "Not found" };

  const channel = await store.getEmployeeChannelByPublicKey(params.publicKey);
  if (!channel || channel.channelProvider !== providerType) {
    // Unknown channel — record a metadata-only event with no org and stop.
    await store.createChannelWebhookEvent({
      organizationId: null,
      channelId: null,
      providerType,
      eventType: "error",
      status: "ignored",
      metadata: { reason: "unknown_channel" },
    });
    return { status: 404, body: "Not found" };
  }

  const config = await resolveProviderConfig(store, channel, provider);

  // --- Signature verification ---------------------------------------------
  const verify = await provider.verifyWebhook(params.request, config);
  const prod = isProduction();
  const allowed = verify.verified || (config.mode !== "live" && !prod);
  if (!allowed) {
    await store.createChannelWebhookEvent({
      organizationId: channel.organizationId,
      channelId: channel.id,
      providerType,
      eventType: "error",
      status: "failed",
      errorCode: "unverified",
      metadata: { reason: verify.reason },
    });
    await store.createAuditEvent({
      organizationId: channel.organizationId,
      actorType: "system",
      actorId: null,
      action: "messaging_webhook.failed",
      targetType: "employee_channel",
      targetId: channel.id,
      metadata: { channelId: channel.id, reason: "unverified" },
    });
    return { status: 401, body: "Unauthorized" };
  }

  // --- Delivery status callbacks ------------------------------------------
  const delivery = provider.parseDeliveryStatus(params.request);
  if (delivery) {
    await store.createChannelWebhookEvent({
      organizationId: channel.organizationId,
      channelId: channel.id,
      providerType,
      eventType: "delivery_status",
      externalEventId: delivery.externalMessageId || null,
      status: delivery.deliveryStatus === "failed" ? "failed" : "processed",
      processedAt: new Date().toISOString(),
      metadata: { deliveryStatus: delivery.deliveryStatus },
    });
    await store.createAuditEvent({
      organizationId: channel.organizationId,
      actorType: "system",
      actorId: null,
      action: "messaging_message.delivery_updated",
      targetType: "employee_channel",
      targetId: channel.id,
      metadata: { channelId: channel.id, deliveryStatus: delivery.deliveryStatus },
    });
    return OK;
  }

  // --- Inbound messages ----------------------------------------------------
  const inbound = provider.parseInboundWebhook(params.request);
  if (!inbound) {
    await store.createChannelWebhookEvent({
      organizationId: channel.organizationId,
      channelId: channel.id,
      providerType,
      eventType: "ignored",
      status: "ignored",
      metadata: { reason: "no_message" },
    });
    return OK;
  }

  await handleInboundMessagingMessage(deps, { channel, provider, config, inbound });
  return OK;
}
