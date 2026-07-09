/**
 * Messaging provider registry (Prompt 009).
 *
 * Resolves a provider adapter by provider type. Product code resolves providers
 * here and never imports a provider SDK directly. custom_webhook and the local
 * simulator use the simulated provider.
 */

import type { ChannelProviderType } from "@/lib/db/types";
import type { MessagingProvider } from "@/modules/channels/messaging/types";
import { twilioProvider } from "@/modules/channels/messaging/providers/twilio";
import { metaWhatsAppProvider } from "@/modules/channels/messaging/providers/meta-whatsapp";
import { sendgridProvider } from "@/modules/channels/messaging/providers/sendgrid-email";
import { mailgunProvider } from "@/modules/channels/messaging/providers/mailgun-email";
import { telegramProvider } from "@/modules/channels/messaging/providers/telegram";
import {
  messengerProvider,
  instagramProvider,
} from "@/modules/channels/messaging/providers/meta-messaging";
import { slackProvider } from "@/modules/channels/slack/provider";
import { createSimulatedProvider } from "@/modules/channels/messaging/providers/simulated";

export const customWebhookProvider = createSimulatedProvider(
  "custom_webhook",
  "sms",
  "Custom webhook",
);

const REGISTRY: Partial<Record<ChannelProviderType, MessagingProvider>> = {
  twilio: twilioProvider,
  meta_whatsapp_cloud: metaWhatsAppProvider,
  sendgrid: sendgridProvider,
  mailgun: mailgunProvider,
  telegram: telegramProvider,
  meta_messenger: messengerProvider,
  meta_instagram: instagramProvider,
  slack: slackProvider,
  custom_webhook: customWebhookProvider,
};

export function getMessagingProvider(providerType: ChannelProviderType): MessagingProvider | null {
  return REGISTRY[providerType] ?? null;
}

/** Map a route path segment (e.g. "meta-whatsapp") to a provider type. */
export const WEBHOOK_PROVIDER_SLUGS: Record<string, ChannelProviderType> = {
  twilio: "twilio",
  "meta-whatsapp": "meta_whatsapp_cloud",
  sendgrid: "sendgrid",
  mailgun: "mailgun",
  telegram: "telegram",
  messenger: "meta_messenger",
  instagram: "meta_instagram",
  custom: "custom_webhook",
};
