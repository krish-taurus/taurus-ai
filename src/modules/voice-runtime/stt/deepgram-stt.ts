/**
 * Deepgram speech-to-text (Prompt 010) — foundation only.
 *
 * Implements the STT interface + reports whether a Deepgram key is configured.
 * Real-time audio transcription is a later sprint; in this sprint it operates on
 * the supplied text and makes no external calls.
 */

import type {
  SttProvider,
  SttResult,
  SttTranscribeRequest,
} from "@/modules/voice-runtime/stt/types";

export const deepgramStt: SttProvider = {
  providerType: "deepgram_stt",
  displayName: "Deepgram",
  async transcribeAudioChunk(request: SttTranscribeRequest): Promise<SttResult> {
    // Foundation: no audio pipeline yet — echo the supplied text.
    return { text: (request.simulatedText ?? "").trim(), confidence: 0.95, isFinal: true };
  },
  async startStreamingTranscription(): Promise<{ streamId: string }> {
    return { streamId: `dg_stt_${globalThis.crypto.randomUUID().slice(0, 12)}` };
  },
  async stopStreamingTranscription(): Promise<void> {
    /* no-op foundation */
  },
  isEnvConfigured(): boolean {
    return !!process.env.DEEPGRAM_API_KEY;
  },
  getStatus(): { mode: "live" | "simulated" | "unavailable" } {
    return { mode: process.env.DEEPGRAM_API_KEY ? "live" : "simulated" };
  },
};
