/**
 * Simulated speech-to-text (Prompt 010).
 *
 * Echoes the supplied caller text. No audio, no network. Used for local dev,
 * tests, and the "Simulate Phone Call" panel.
 */

import type {
  SttProvider,
  SttResult,
  SttTranscribeRequest,
} from "@/modules/voice-runtime/stt/types";

export const simulatedStt: SttProvider = {
  providerType: "simulated_stt",
  displayName: "Simulated",
  async transcribeAudioChunk(request: SttTranscribeRequest): Promise<SttResult> {
    return { text: (request.simulatedText ?? "").trim(), confidence: 1, isFinal: true };
  },
  async startStreamingTranscription(): Promise<{ streamId: string }> {
    return { streamId: `sim_stt_${globalThis.crypto.randomUUID().slice(0, 12)}` };
  },
  async stopStreamingTranscription(): Promise<void> {
    /* no-op */
  },
  isEnvConfigured(): boolean {
    return true;
  },
  getStatus(): { mode: "simulated" } {
    return { mode: "simulated" };
  },
};
