/**
 * Simulated text-to-speech (Prompt 010).
 *
 * Returns only a status + character count — never audio. Used for local dev,
 * tests, and the "Simulate Phone Call" panel.
 */

import type {
  TtsProvider,
  TtsResult,
  TtsSynthesizeRequest,
} from "@/modules/voice-runtime/tts/types";

export const simulatedTts: TtsProvider = {
  providerType: "simulated_tts",
  displayName: "Simulated",
  async synthesizeSpeech(request: TtsSynthesizeRequest): Promise<TtsResult> {
    return { status: "simulated", audioRef: null, characters: request.text.length };
  },
  async startStreamingSpeech(): Promise<{ streamId: string }> {
    return { streamId: `sim_tts_${globalThis.crypto.randomUUID().slice(0, 12)}` };
  },
  async stopStreamingSpeech(): Promise<void> {
    /* no-op */
  },
  isEnvConfigured(): boolean {
    return true;
  },
  getStatus(): { mode: "simulated" } {
    return { mode: "simulated" };
  },
};
