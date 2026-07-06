/**
 * Channel provider registry (Prompt 008).
 *
 * Maps a provider type to its adapter. Only taurus_web is runnable; the rest are
 * placeholders reserved for future sprints. Product code resolves providers here
 * and never imports a provider SDK directly.
 */

import type { ChannelProviderType } from "@/lib/db/types";
import type { ChannelProvider, ChannelRuntime } from "@/modules/channels/types";
import { webChannelProvider } from "@/modules/channels/providers/web";
import { createPlaceholderProvider } from "@/modules/channels/providers/placeholder";

export const CHANNEL_PROVIDERS: Record<ChannelProviderType, ChannelProvider & ChannelRuntime> = {
  taurus_web: webChannelProvider,
  twilio: createPlaceholderProvider("twilio", ["messaging", "voice"]),
  meta_whatsapp_cloud: createPlaceholderProvider("meta_whatsapp_cloud", ["messaging"]),
  telnyx: createPlaceholderProvider("telnyx", ["voice"]),
  vonage: createPlaceholderProvider("vonage", ["voice", "messaging"]),
  sendgrid: createPlaceholderProvider("sendgrid", ["messaging"]),
  mailgun: createPlaceholderProvider("mailgun", ["messaging"]),
  slack: createPlaceholderProvider("slack", ["workplace"]),
  microsoft_graph: createPlaceholderProvider("microsoft_graph", ["workplace"]),
  telegram: createPlaceholderProvider("telegram", ["messaging"]),
  custom_webhook: createPlaceholderProvider("custom_webhook", ["messaging"]),
  // Voice providers (Prompt 010) run through the dedicated voice-runtime module,
  // not the web/messaging chat-generation path — placeholders here.
  twilio_voice: createPlaceholderProvider("twilio_voice", ["voice"]),
  telnyx_voice: createPlaceholderProvider("telnyx_voice", ["voice"]),
  vonage_voice: createPlaceholderProvider("vonage_voice", ["voice"]),
  simulated_voice: createPlaceholderProvider("simulated_voice", ["voice"]),
};

export function getChannelProvider(
  providerType: ChannelProviderType,
): ChannelProvider & ChannelRuntime {
  return CHANNEL_PROVIDERS[providerType];
}
