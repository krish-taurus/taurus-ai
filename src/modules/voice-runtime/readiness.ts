/**
 * Voice channel readiness (Prompt 010) — server only.
 *
 * Reuses the chat readiness (DNA / knowledge / Employee Brain) and adds voice
 * checks (channel active, phone number configured, STT/TTS ready). Drives the
 * readiness checklist + whether "Simulate Phone Call" is available.
 */

import type { AiEmployee, EmployeeChannel, VoicePhoneNumber } from "@/lib/db/types";
import type { DataStore } from "@/lib/db/store";
import { computeChatReadiness } from "@/modules/employee-chat/readiness";
import { readVoiceConfig } from "@/modules/voice-runtime/catalog";
import { getSttProvider } from "@/modules/voice-runtime/stt";
import { getTtsProvider } from "@/modules/voice-runtime/tts";
import type { SttProviderType } from "@/modules/voice-runtime/stt/types";
import type { TtsProviderType } from "@/modules/voice-runtime/tts/types";

export interface VoiceReadiness {
  employeeActive: boolean;
  dnaPublished: boolean;
  knowledgeAssigned: boolean;
  brainReady: boolean;
  channelActive: boolean;
  phoneNumberConfigured: boolean;
  sttConfigured: boolean;
  ttsConfigured: boolean;
  canSimulate: boolean;
}

export async function computeVoiceReadiness(
  store: DataStore,
  params: {
    organizationId: string;
    employee: AiEmployee;
    channel: EmployeeChannel | null;
    phoneNumber: VoicePhoneNumber | null;
  },
): Promise<VoiceReadiness> {
  const chat = await computeChatReadiness(store, {
    organizationId: params.organizationId,
    employee: params.employee,
  });

  const channelActive = params.channel?.status === "active";
  const voiceConfig = params.channel ? readVoiceConfig(params.channel.providerConfig ?? {}) : null;
  const sttConfigured = voiceConfig
    ? getSttProvider(voiceConfig.sttProvider as SttProviderType).getStatus().mode !== "unavailable"
    : false;
  const ttsConfigured = voiceConfig
    ? getTtsProvider(voiceConfig.ttsProvider as TtsProviderType).getStatus().mode !== "unavailable"
    : false;

  const employeeActive = params.employee.status !== "archived";

  return {
    employeeActive,
    dnaPublished: chat.dnaPublished,
    knowledgeAssigned: chat.assignedKnowledgeCount > 0,
    brainReady: chat.brainMode !== "unavailable",
    channelActive,
    phoneNumberConfigured: !!params.phoneNumber,
    sttConfigured,
    ttsConfigured,
    canSimulate: employeeActive && chat.dnaPublished && channelActive,
  };
}
