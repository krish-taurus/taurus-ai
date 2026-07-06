/**
 * Voice provider registry (Prompt 010).
 *
 * Resolves a voice provider adapter by provider type. Product code resolves
 * providers here and never imports a provider SDK directly.
 */

import type { ChannelProviderType, VoiceProviderType } from "@/lib/db/types";
import type { VoiceProvider } from "@/modules/voice-runtime/types";
import { simulatedVoiceProvider } from "@/modules/voice-runtime/providers/simulated-voice";
import { twilioVoiceProvider } from "@/modules/voice-runtime/providers/twilio-voice";
import { telnyxVoiceProvider } from "@/modules/voice-runtime/providers/telnyx-voice";
import { vonageVoiceProvider } from "@/modules/voice-runtime/providers/vonage-voice";

const REGISTRY: Record<VoiceProviderType, VoiceProvider> = {
  simulated_voice: simulatedVoiceProvider,
  twilio_voice: twilioVoiceProvider,
  telnyx_voice: telnyxVoiceProvider,
  vonage_voice: vonageVoiceProvider,
};

export function getVoiceProvider(providerType: ChannelProviderType): VoiceProvider | null {
  return REGISTRY[providerType as VoiceProviderType] ?? null;
}

/** Map a route path segment (e.g. "twilio") to a voice provider type. */
export const VOICE_WEBHOOK_PROVIDER_SLUGS: Record<string, VoiceProviderType> = {
  twilio: "twilio_voice",
  telnyx: "telnyx_voice",
  vonage: "vonage_voice",
  simulated: "simulated_voice",
};

/** Reverse: provider type → webhook route slug. */
export const VOICE_PROVIDER_TO_SLUG: Record<VoiceProviderType, string> = {
  twilio_voice: "twilio",
  telnyx_voice: "telnyx",
  vonage_voice: "vonage",
  simulated_voice: "simulated",
};
