/**
 * Messaging catalog (Prompt 009).
 *
 * Which providers can serve each messaging channel, plus friendly labels. Adding
 * a provider later is a catalog + adapter change, not a rewrite.
 */

import type { ChannelProviderType, ChannelType } from "@/lib/db/types";

export const MESSAGING_CHANNEL_TYPES: ChannelType[] = [
  "whatsapp",
  "sms",
  "email",
  "telegram",
  "facebook_messenger",
  "instagram_dm",
];

export const MESSAGING_CHANNEL_LABELS: Partial<Record<ChannelType, string>> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Email",
  telegram: "Telegram",
  facebook_messenger: "Facebook Messenger",
  instagram_dm: "Instagram DM",
};

export const MESSAGING_PROVIDER_LABELS: Partial<Record<ChannelProviderType, string>> = {
  twilio: "Twilio",
  meta_whatsapp_cloud: "Meta WhatsApp Cloud",
  sendgrid: "SendGrid",
  mailgun: "Mailgun",
  telegram: "Telegram Bot",
  meta_messenger: "Meta (Facebook Page)",
  meta_instagram: "Meta (Instagram)",
  custom_webhook: "Custom webhook",
};

/** Providers that can serve a given messaging channel type. */
export const PROVIDERS_FOR_CHANNEL: Record<string, ChannelProviderType[]> = {
  whatsapp: ["twilio", "meta_whatsapp_cloud", "custom_webhook"],
  sms: ["twilio", "custom_webhook"],
  email: ["sendgrid", "mailgun", "custom_webhook"],
  telegram: ["telegram"],
  facebook_messenger: ["meta_messenger"],
  instagram_dm: ["meta_instagram"],
};

export function providersForChannelType(channelType: ChannelType): ChannelProviderType[] {
  return PROVIDERS_FOR_CHANNEL[channelType] ?? [];
}

export function defaultProviderForChannelType(channelType: ChannelType): ChannelProviderType {
  return providersForChannelType(channelType)[0] ?? "custom_webhook";
}

export function isMessagingChannelType(channelType: ChannelType): boolean {
  return MESSAGING_CHANNEL_TYPES.includes(channelType);
}

/** External-sender identifier labels shown in setup (non-technical). */
export const SENDER_ID_LABELS: Partial<Record<ChannelType, string>> = {
  whatsapp: "WhatsApp business number",
  sms: "SMS phone number",
  email: "From email address",
  telegram: "Telegram username (optional)",
  facebook_messenger: "Facebook Page name (optional)",
  instagram_dm: "Instagram handle (optional)",
};
