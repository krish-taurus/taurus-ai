/**
 * TTS provider registry (Prompt 010).
 */

import type { TtsProvider, TtsProviderType } from "@/modules/voice-runtime/tts/types";
import { simulatedTts } from "@/modules/voice-runtime/tts/simulated-tts";
import { elevenLabsTts } from "@/modules/voice-runtime/tts/elevenlabs-tts";
import { deepgramTts } from "@/modules/voice-runtime/tts/deepgram-tts";

const REGISTRY: Record<TtsProviderType, TtsProvider> = {
  simulated_tts: simulatedTts,
  elevenlabs_tts: elevenLabsTts,
  deepgram_tts: deepgramTts,
  // Placeholders — reuse the simulated adapter until implemented.
  cartesia_tts: { ...simulatedTts, providerType: "cartesia_tts", displayName: "Cartesia" },
  azure_speech: { ...simulatedTts, providerType: "azure_speech", displayName: "Azure Speech" },
};

export const TTS_PROVIDER_TYPES: TtsProviderType[] = [
  "simulated_tts",
  "elevenlabs_tts",
  "deepgram_tts",
];

export const TTS_PROVIDER_LABELS: Record<TtsProviderType, string> = {
  simulated_tts: "Simulated",
  elevenlabs_tts: "ElevenLabs",
  deepgram_tts: "Deepgram",
  cartesia_tts: "Cartesia",
  azure_speech: "Azure Speech",
};

export function getTtsProvider(providerType: TtsProviderType): TtsProvider {
  return REGISTRY[providerType] ?? simulatedTts;
}
