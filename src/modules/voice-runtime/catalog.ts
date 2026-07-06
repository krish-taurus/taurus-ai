/**
 * Voice catalog (Prompt 010).
 *
 * Voice provider metadata + the non-technical option sets shown in setup (voice
 * style, recording, transcript). Adding a provider later is a catalog + adapter
 * change, not a rewrite.
 */

import type { VoiceProviderType } from "@/lib/db/types";

export const VOICE_PROVIDER_TYPES: VoiceProviderType[] = [
  "simulated_voice",
  "twilio_voice",
  "telnyx_voice",
  "vonage_voice",
];

export const VOICE_PROVIDER_LABELS: Record<VoiceProviderType, string> = {
  simulated_voice: "Simulated (test)",
  twilio_voice: "Twilio",
  telnyx_voice: "Telnyx",
  vonage_voice: "Vonage",
};

export const DEFAULT_VOICE_PROVIDER: VoiceProviderType = "simulated_voice";

/** Voice style options (plain language). */
export const VOICE_STYLES = ["Professional", "Warm", "Direct", "Luxury", "Friendly"] as const;
export type VoiceStyle = (typeof VOICE_STYLES)[number];

/** Recording setting options. Full recording storage is not built yet. */
export const RECORDING_SETTINGS = [
  { value: "disabled", label: "Disabled" },
  { value: "metadata_only", label: "Metadata only" },
  { value: "full_recording_coming_soon", label: "Coming soon: full recording" },
] as const;
export type RecordingSetting = (typeof RECORDING_SETTINGS)[number]["value"];

/** Transcript setting options. */
export const TRANSCRIPT_SETTINGS = [
  { value: "save_transcript", label: "Save transcript" },
  { value: "do_not_save", label: "Do not save transcript" },
] as const;
export type TranscriptSetting = (typeof TRANSCRIPT_SETTINGS)[number]["value"];

export function isVoiceProviderType(value: string): value is VoiceProviderType {
  return (VOICE_PROVIDER_TYPES as string[]).includes(value);
}

/** Non-secret voice config stored on the channel's providerConfig. */
export interface VoiceChannelConfig {
  voiceStyle: VoiceStyle;
  sttProvider: string;
  ttsProvider: string;
  recordingSetting: RecordingSetting;
  transcriptSetting: TranscriptSetting;
  businessHours: string | null;
  escalationNote: string | null;
}

export function defaultVoiceConfig(): VoiceChannelConfig {
  return {
    voiceStyle: "Professional",
    sttProvider: "simulated_stt",
    ttsProvider: "simulated_tts",
    recordingSetting: "disabled",
    transcriptSetting: "save_transcript",
    businessHours: null,
    escalationNote: null,
  };
}

export function readVoiceConfig(raw: Record<string, unknown>): VoiceChannelConfig {
  const d = defaultVoiceConfig();
  const style = raw.voiceStyle;
  return {
    voiceStyle: (VOICE_STYLES as readonly string[]).includes(String(style))
      ? (style as VoiceStyle)
      : d.voiceStyle,
    sttProvider: typeof raw.sttProvider === "string" ? raw.sttProvider : d.sttProvider,
    ttsProvider: typeof raw.ttsProvider === "string" ? raw.ttsProvider : d.ttsProvider,
    recordingSetting: (RECORDING_SETTINGS.map((r) => r.value) as string[]).includes(
      String(raw.recordingSetting),
    )
      ? (raw.recordingSetting as RecordingSetting)
      : d.recordingSetting,
    transcriptSetting:
      String(raw.transcriptSetting) === "do_not_save" ? "do_not_save" : "save_transcript",
    businessHours: typeof raw.businessHours === "string" ? raw.businessHours : null,
    escalationNote: typeof raw.escalationNote === "string" ? raw.escalationNote : null,
  };
}
