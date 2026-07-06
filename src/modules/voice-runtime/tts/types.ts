/**
 * Text-to-speech provider interface (Prompt 010).
 *
 * Foundation-only. NO raw audio is produced or stored in this sprint — adapters
 * return only a status + character count. Real audio synthesis + streaming is a
 * later sprint. Product code depends on this interface, never on a provider SDK.
 */

export type TtsProviderType =
  | "simulated_tts"
  | "elevenlabs_tts"
  | "deepgram_tts"
  | "cartesia_tts"
  | "azure_speech";

export interface TtsSynthesizeRequest {
  text: string;
  voiceStyle?: string;
}

export interface TtsResult {
  status: "synthesized" | "simulated" | "failed";
  /** Always null — no raw audio is stored in this sprint. */
  audioRef: null;
  characters: number;
}

export interface TtsProvider {
  providerType: TtsProviderType;
  displayName: string;
  synthesizeSpeech(request: TtsSynthesizeRequest): Promise<TtsResult>;
  startStreamingSpeech(request: TtsSynthesizeRequest): Promise<{ streamId: string }>;
  stopStreamingSpeech(streamId: string): Promise<void>;
  isEnvConfigured(): boolean;
  getStatus(): { mode: "live" | "simulated" | "unavailable" };
}
