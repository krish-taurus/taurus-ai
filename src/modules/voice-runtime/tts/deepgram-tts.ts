/**
 * Deepgram text-to-speech (Prompt 010) — foundation only.
 *
 * Implements the TTS interface + reports whether a Deepgram key is configured.
 * No audio storage, no external calls this sprint.
 */

import type {
  TtsProvider,
  TtsResult,
  TtsSynthesizeRequest,
} from "@/modules/voice-runtime/tts/types";

export const deepgramTts: TtsProvider = {
  providerType: "deepgram_tts",
  displayName: "Deepgram",
  async synthesizeSpeech(request: TtsSynthesizeRequest): Promise<TtsResult> {
    const configured = !!process.env.DEEPGRAM_API_KEY;
    return {
      status: configured ? "synthesized" : "simulated",
      audioRef: null,
      characters: request.text.length,
    };
  },
  async startStreamingSpeech(): Promise<{ streamId: string }> {
    return { streamId: `dg_tts_${globalThis.crypto.randomUUID().slice(0, 12)}` };
  },
  async stopStreamingSpeech(): Promise<void> {
    /* no-op foundation */
  },
  isEnvConfigured(): boolean {
    return !!process.env.DEEPGRAM_API_KEY;
  },
  getStatus(): { mode: "live" | "simulated" | "unavailable" } {
    return { mode: process.env.DEEPGRAM_API_KEY ? "live" : "simulated" };
  },
};
