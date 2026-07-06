/**
 * ElevenLabs text-to-speech (Prompt 010) — foundation only.
 *
 * Implements the TTS interface + reports whether an ElevenLabs key is configured.
 * Real audio synthesis is a later sprint; this sprint stores no audio and makes
 * no external calls.
 */

import type {
  TtsProvider,
  TtsResult,
  TtsSynthesizeRequest,
} from "@/modules/voice-runtime/tts/types";

export const elevenLabsTts: TtsProvider = {
  providerType: "elevenlabs_tts",
  displayName: "ElevenLabs",
  async synthesizeSpeech(request: TtsSynthesizeRequest): Promise<TtsResult> {
    // Foundation: no audio pipeline yet — report status + length only.
    const configured = !!process.env.ELEVENLABS_API_KEY;
    return {
      status: configured ? "synthesized" : "simulated",
      audioRef: null,
      characters: request.text.length,
    };
  },
  async startStreamingSpeech(): Promise<{ streamId: string }> {
    return { streamId: `el_tts_${globalThis.crypto.randomUUID().slice(0, 12)}` };
  },
  async stopStreamingSpeech(): Promise<void> {
    /* no-op foundation */
  },
  isEnvConfigured(): boolean {
    return !!process.env.ELEVENLABS_API_KEY;
  },
  getStatus(): { mode: "live" | "simulated" | "unavailable" } {
    return { mode: process.env.ELEVENLABS_API_KEY ? "live" : "simulated" };
  },
};
