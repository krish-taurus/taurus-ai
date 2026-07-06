/**
 * Simulated phone call orchestration (Prompt 010) — server only.
 *
 * Thin wrappers around the voice runtime for the dashboard "Simulate Phone Call"
 * panel. Always uses a simulated provider config so no real telephony/audio ever
 * happens, even if credentials exist.
 */

import type { AiEmployee, EmployeeChannel, VoiceCallSession } from "@/lib/db/types";
import { getVoiceProvider } from "@/modules/voice-runtime/providers";
import {
  endVoiceCall,
  handleVoiceTurn,
  startVoiceCall,
  type StartVoiceCallResult,
  type VoiceRuntimeDeps,
  type VoiceTurnResult,
} from "@/modules/voice-runtime/runtime";
import type { NormalizedInboundCall } from "@/modules/voice-runtime/types";

function simulatedConfig(channel: EmployeeChannel) {
  return { mode: "simulated" as const, secrets: {}, channelConfig: channel.providerConfig ?? {} };
}

/** Start a simulated inbound call. */
export async function startSimulatedCall(
  deps: VoiceRuntimeDeps,
  params: {
    channel: EmployeeChannel;
    from: string;
    name?: string | null;
    phoneNumberId?: string | null;
  },
): Promise<StartVoiceCallResult> {
  const provider = getVoiceProvider(params.channel.channelProvider);
  if (!provider) {
    return {
      status: "rejected",
      reason: "failed",
      response: { contentType: "text/plain", body: "This provider is not available." },
      greeting: "This provider is not available.",
    };
  }
  const inboundCall: NormalizedInboundCall = {
    providerType: params.channel.channelProvider,
    externalCallId: `sim_${Date.now()}`,
    direction: "inbound",
    callerExternalId: params.from,
    callerLabel: params.name ?? null,
    toNumber: null,
    metadata: { simulated: true },
  };
  return startVoiceCall(deps, {
    channel: params.channel,
    provider,
    config: simulatedConfig(params.channel),
    inboundCall,
    phoneNumberId: params.phoneNumberId ?? null,
  });
}

/** Send one caller utterance in a simulated call. */
export async function sendSimulatedUtterance(
  deps: VoiceRuntimeDeps,
  params: {
    channel: EmployeeChannel;
    employee: AiEmployee;
    callSession: VoiceCallSession;
    text: string;
  },
): Promise<VoiceTurnResult> {
  return handleVoiceTurn(deps, {
    channel: params.channel,
    employee: params.employee,
    callSession: params.callSession,
    utteranceText: params.text,
  });
}

/** End a simulated call. */
export async function endSimulatedCall(
  deps: VoiceRuntimeDeps,
  params: { channel: EmployeeChannel; callSession: VoiceCallSession },
): Promise<VoiceCallSession | null> {
  return endVoiceCall(deps, { ...params, endReason: "caller_ended_simulated" });
}
