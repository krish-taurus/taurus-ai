/**
 * Channel catalog (Prompt 008).
 *
 * The full multi-channel map. Web channels are runnable this sprint; the rest are
 * reserved foundation ("coming soon"). Adding a new channel later is a catalog +
 * provider change, not a rewrite.
 */

import type { ChannelCategory, ChannelProviderType, ChannelType } from "@/lib/db/types";

export interface ChannelDefinition {
  type: ChannelType;
  category: ChannelCategory;
  label: string;
  description: string;
  providerType: ChannelProviderType;
  availability: "available" | "coming_soon";
}

export const CHANNEL_CATEGORY_LABELS: Record<ChannelCategory, string> = {
  web: "Website",
  messaging: "Messaging",
  voice: "Phone calls",
  workplace: "Workplace apps",
};

/** Ordered so the dashboard renders Website first, then coming-soon sections. */
export const CHANNEL_DEFINITIONS: ChannelDefinition[] = [
  // --- Web (available now) -------------------------------------------------
  {
    type: "website_widget",
    category: "web",
    label: "Website Widget",
    description: "A floating chat launcher you add to any website with one line of code.",
    providerType: "taurus_web",
    availability: "available",
  },
  {
    type: "hosted_chat",
    category: "web",
    label: "Hosted Chat Link",
    description: "A shareable Taurus-hosted chat page — no website required.",
    providerType: "taurus_web",
    availability: "available",
  },
  {
    type: "iframe_embed",
    category: "web",
    label: "Iframe Embed",
    description: "Embed the chat directly inside a page of your site.",
    providerType: "taurus_web",
    availability: "available",
  },
  {
    type: "public_api",
    category: "web",
    label: "Public API",
    description: "Send messages to your AI Employee from your own code.",
    providerType: "taurus_web",
    availability: "available",
  },

  // --- Messaging (coming soon) ---------------------------------------------
  {
    type: "whatsapp",
    category: "messaging",
    label: "WhatsApp",
    description: "Let customers reach your AI Employee on WhatsApp.",
    providerType: "meta_whatsapp_cloud",
    availability: "coming_soon",
  },
  {
    type: "sms",
    category: "messaging",
    label: "SMS",
    description: "Two-way text messaging with your AI Employee.",
    providerType: "twilio",
    availability: "coming_soon",
  },
  {
    type: "email",
    category: "messaging",
    label: "Email",
    description: "Answer inbound email with your AI Employee.",
    providerType: "sendgrid",
    availability: "coming_soon",
  },
  {
    type: "telegram",
    category: "messaging",
    label: "Telegram",
    description: "Connect your AI Employee to a Telegram bot.",
    providerType: "telegram",
    availability: "available",
  },
  {
    type: "instagram_dm",
    category: "messaging",
    label: "Instagram DM",
    description: "Reply to Instagram direct messages.",
    providerType: "custom_webhook",
    availability: "coming_soon",
  },
  {
    type: "facebook_messenger",
    category: "messaging",
    label: "Facebook Messenger",
    description: "Reply to Messenger conversations.",
    providerType: "custom_webhook",
    availability: "coming_soon",
  },

  // --- Voice (coming soon) -------------------------------------------------
  {
    type: "phone_call",
    category: "voice",
    label: "Phone Calls",
    description: "Let your AI Employee answer phone calls.",
    providerType: "telnyx",
    availability: "coming_soon",
  },

  // --- Workplace (coming soon) ---------------------------------------------
  {
    type: "slack",
    category: "workplace",
    label: "Slack",
    description: "Bring your AI Employee into your Slack workspace.",
    providerType: "slack",
    availability: "coming_soon",
  },
  {
    type: "microsoft_teams",
    category: "workplace",
    label: "Microsoft Teams",
    description: "Bring your AI Employee into Microsoft Teams.",
    providerType: "microsoft_graph",
    availability: "coming_soon",
  },
];

export const CHANNEL_DEFINITIONS_BY_TYPE: Record<ChannelType, ChannelDefinition> =
  Object.fromEntries(CHANNEL_DEFINITIONS.map((d) => [d.type, d])) as Record<
    ChannelType,
    ChannelDefinition
  >;

export function getChannelDefinition(type: ChannelType): ChannelDefinition {
  return CHANNEL_DEFINITIONS_BY_TYPE[type];
}

export function channelsInCategory(category: ChannelCategory): ChannelDefinition[] {
  return CHANNEL_DEFINITIONS.filter((d) => d.category === category);
}

/** Category display order for the dashboard. */
export const CHANNEL_CATEGORY_ORDER: ChannelCategory[] = ["web", "messaging", "voice", "workplace"];

/** The single channel type created by "Add to Website" (powers all web surfaces). */
export const WEB_CHANNEL_TYPE: ChannelType = "website_widget";
