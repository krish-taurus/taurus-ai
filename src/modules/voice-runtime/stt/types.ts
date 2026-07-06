/**
 * Speech-to-text provider interface (Prompt 010).
 *
 * Foundation-only. This sprint operates on TEXT (the simulated call flow), so
 * adapters never touch real audio and never call external APIs. Real streaming
 * transcription is a later sprint. Product code depends on this interface, never
 * on a provider SDK.
 */

export type SttProviderType = "simulated_stt" | "deepgram_stt" | "openai_voice";

export interface SttTranscribeRequest {
  /** In the simulated flow, the caller's utterance is supplied as text. */
  simulatedText?: string;
  language?: string;
}

export interface SttResult {
  text: string;
  confidence: number | null;
  isFinal: boolean;
}

export interface SttProvider {
  providerType: SttProviderType;
  displayName: string;
  transcribeAudioChunk(request: SttTranscribeRequest): Promise<SttResult>;
  startStreamingTranscription(request: SttTranscribeRequest): Promise<{ streamId: string }>;
  stopStreamingTranscription(streamId: string): Promise<void>;
  isEnvConfigured(): boolean;
  getStatus(): { mode: "live" | "simulated" | "unavailable" };
}
