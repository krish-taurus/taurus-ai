/**
 * STT provider registry (Prompt 010).
 */

import type { SttProvider, SttProviderType } from "@/modules/voice-runtime/stt/types";
import { simulatedStt } from "@/modules/voice-runtime/stt/simulated-stt";
import { deepgramStt } from "@/modules/voice-runtime/stt/deepgram-stt";

const REGISTRY: Record<SttProviderType, SttProvider> = {
  simulated_stt: simulatedStt,
  deepgram_stt: deepgramStt,
  // Placeholder — reuses the simulated adapter until implemented.
  openai_voice: { ...simulatedStt, providerType: "openai_voice", displayName: "OpenAI Voice" },
};

export const STT_PROVIDER_TYPES: SttProviderType[] = [
  "simulated_stt",
  "deepgram_stt",
  "openai_voice",
];

export const STT_PROVIDER_LABELS: Record<SttProviderType, string> = {
  simulated_stt: "Simulated",
  deepgram_stt: "Deepgram",
  openai_voice: "OpenAI Voice",
};

export function getSttProvider(providerType: SttProviderType): SttProvider {
  return REGISTRY[providerType] ?? simulatedStt;
}
