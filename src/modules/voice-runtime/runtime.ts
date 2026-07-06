/**
 * Voice call runtime (Prompt 010) — server only.
 *
 * Turns an inbound call into a voice conversation, REUSING the Employee Chat
 * Runtime (Model Gateway only) for reasoning. Caller speech becomes text via the
 * STT adapter; the reply becomes speech via the TTS adapter (no raw audio stored
 * this sprint). Caller numbers are hashed; transcript content lives only in the
 * transcript store; all call/stream events are metadata only.
 */

import type {
  AiEmployee,
  ChatSourceReference,
  EmployeeChannel,
  VoiceCallSession,
} from "@/lib/db/types";
import type { DataStore } from "@/lib/db/store";
import type { ChatGateway } from "@/modules/employee-chat/service";
import { ChatBlockedError, sendChatMessage } from "@/modules/employee-chat/service";
import { hashContact } from "@/modules/channels/keys";
import type {
  NormalizedInboundCall,
  VoiceCallResponse,
  VoiceProvider,
  VoiceProviderConfig,
} from "@/modules/voice-runtime/types";
import { readVoiceConfig } from "@/modules/voice-runtime/catalog";
import { getSttProvider } from "@/modules/voice-runtime/stt";
import { getTtsProvider } from "@/modules/voice-runtime/tts";
import { toTranscriptSources } from "@/modules/voice-runtime/transcript";
import type { SttProviderType } from "@/modules/voice-runtime/stt/types";
import type { TtsProviderType } from "@/modules/voice-runtime/tts/types";

export type VoiceRejectReason = "inactive" | "employee_unavailable" | "needs_dna" | "failed";

export interface VoiceRuntimeDeps {
  store: DataStore;
  gateway: ChatGateway;
  isProduction?: () => boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function audit(
  store: DataStore,
  channel: EmployeeChannel,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  await store.createAuditEvent({
    organizationId: channel.organizationId,
    actorType: "system",
    actorId: null,
    action,
    targetType: "employee_channel",
    targetId: channel.id,
    metadata: { channelId: channel.id, channelType: channel.channelType, ...metadata },
  });
}

const FALLBACK_GREETING =
  "Thank you for calling. We're sorry, but this line isn't available right now. Please try again later.";

export interface StartVoiceCallParams {
  channel: EmployeeChannel;
  provider: VoiceProvider;
  config: VoiceProviderConfig;
  inboundCall: NormalizedInboundCall;
  phoneNumberId?: string | null;
}

export interface StartVoiceCallResult {
  status: "started" | "rejected";
  reason?: VoiceRejectReason;
  callSession?: VoiceCallSession;
  response: VoiceCallResponse;
  greeting: string;
}

/** Answer an inbound call: validate, create the call + greeting response. */
export async function startVoiceCall(
  deps: VoiceRuntimeDeps,
  params: StartVoiceCallParams,
): Promise<StartVoiceCallResult> {
  const { store } = deps;
  const { channel, provider, inboundCall } = params;
  const orgId = channel.organizationId;

  const fallback = (reason: VoiceRejectReason): StartVoiceCallResult => ({
    status: "rejected",
    reason,
    response: provider.createCallResponse({ greeting: FALLBACK_GREETING, config: params.config }),
    greeting: FALLBACK_GREETING,
  });

  // --- Governance gates ----------------------------------------------------
  await store.createVoiceStreamEvent({
    organizationId: orgId,
    channelId: channel.id,
    providerType: channel.channelProvider,
    eventType: "call.webhook_received",
    metadata: { direction: inboundCall.direction },
  });

  if (channel.status !== "active") {
    await audit(store, channel, "voice_call.failed", { reason: "inactive" });
    return fallback("inactive");
  }
  const employee = await store.getEmployee(orgId, channel.employeeId);
  if (!employee || employee.status === "archived") {
    await audit(store, channel, "voice_call.failed", { reason: "employee_unavailable" });
    return fallback("employee_unavailable");
  }
  const published = await store.getPublishedEmployeeDna(orgId, employee.id);
  if (!published) {
    await audit(store, channel, "voice_call.failed", { reason: "needs_dna" });
    return fallback("needs_dna");
  }

  // --- Create the call session (caller number hashed, never stored raw) -----
  const callerHash = await hashContact(inboundCall.callerExternalId);
  const voiceConfig = readVoiceConfig(channel.providerConfig ?? {});
  const thread = await store.createEmployeeChatThread({
    organizationId: orgId,
    employeeId: employee.id,
    title: "Phone call",
    createdByUserId: null,
  });

  const callSession = await store.createVoiceCallSession({
    organizationId: orgId,
    employeeId: employee.id,
    channelId: channel.id,
    phoneNumberId: params.phoneNumberId ?? null,
    providerType: channel.channelProvider,
    externalCallId: inboundCall.externalCallId,
    direction: inboundCall.direction,
    callerHash,
    callerLabel: inboundCall.callerLabel,
    status: "active",
    recordingStatus: voiceConfig.recordingSetting === "disabled" ? "disabled" : "pending",
    transcriptStatus: voiceConfig.transcriptSetting === "do_not_save" ? "pending" : "partial",
    metadata: { threadId: thread.id },
  });
  await store.updateVoiceCallSessionStatus(orgId, callSession.id, {
    answeredAt: nowIso(),
  });

  await audit(store, channel, "voice_call.started", { callSessionId: callSession.id });
  await audit(store, channel, "voice_call.answered", { callSessionId: callSession.id });
  await store.createVoiceStreamEvent({
    organizationId: orgId,
    employeeId: employee.id,
    channelId: channel.id,
    callSessionId: callSession.id,
    providerType: channel.channelProvider,
    eventType: "call.started",
    metadata: {},
  });

  const greeting =
    channel.welcomeMessage?.trim() ||
    `Hi, you've reached ${employee.name}. How can I help you today?`;

  // Store the greeting as the first employee transcript line (if saving).
  if (voiceConfig.transcriptSetting !== "do_not_save") {
    await store.createVoiceTranscriptMessage({
      organizationId: orgId,
      employeeId: employee.id,
      channelId: channel.id,
      callSessionId: callSession.id,
      speakerType: "employee",
      content: greeting,
      metadata: { kind: "greeting" },
    });
  }
  // Synthesize greeting (no audio stored).
  const tts = getTtsProvider(voiceConfig.ttsProvider as TtsProviderType);
  await tts.synthesizeSpeech({ text: greeting, voiceStyle: voiceConfig.voiceStyle });

  return {
    status: "started",
    callSession,
    response: provider.createCallResponse({ greeting, config: params.config }),
    greeting,
  };
}

export interface VoiceTurnResult {
  status: "answered" | "failed";
  reason?: VoiceRejectReason;
  callerText: string;
  replyText: string;
  sources: { name: string; type: string; preview: string }[];
}

/** Process one caller utterance → employee spoken reply. */
export async function handleVoiceTurn(
  deps: VoiceRuntimeDeps,
  params: {
    channel: EmployeeChannel;
    employee: AiEmployee;
    callSession: VoiceCallSession;
    utteranceText: string;
  },
): Promise<VoiceTurnResult> {
  const { store, gateway } = deps;
  const { channel, employee, callSession } = params;
  const orgId = channel.organizationId;
  const voiceConfig = readVoiceConfig(channel.providerConfig ?? {});
  const saveTranscript = voiceConfig.transcriptSetting !== "do_not_save";
  const threadId =
    typeof callSession.metadata.threadId === "string" ? callSession.metadata.threadId : null;

  // --- Caller speech -> text (STT) -----------------------------------------
  const stt = getSttProvider(voiceConfig.sttProvider as SttProviderType);
  const transcribed = await stt.transcribeAudioChunk({ simulatedText: params.utteranceText });
  const callerText = transcribed.text;

  await store.createVoiceStreamEvent({
    organizationId: orgId,
    employeeId: employee.id,
    channelId: channel.id,
    callSessionId: callSession.id,
    providerType: channel.channelProvider,
    eventType: "transcript.final",
    metadata: { speaker: "caller", confidence: transcribed.confidence },
  });

  if (saveTranscript) {
    await store.createVoiceTranscriptMessage({
      organizationId: orgId,
      employeeId: employee.id,
      channelId: channel.id,
      callSessionId: callSession.id,
      speakerType: "caller",
      content: callerText,
      confidence: transcribed.confidence,
    });
    await audit(store, channel, "voice_transcript.message_created", {
      callSessionId: callSession.id,
      speakerType: "caller",
    });
  }

  // --- Reasoning via the Employee Chat Runtime (Model Gateway only) --------
  const organization = await store.getOrganizationById(orgId);
  const organizationName = organization?.name ?? "our company";

  let replyText: string;
  let resultSources: ChatSourceReference[] = [];
  let sourceRefs: { name: string; type: string; preview: string }[] = [];
  let modelProviderSlug: string | null = null;
  let modelId: string | null = null;
  let estimatedCostUsd: number | null = null;

  try {
    const result = await sendChatMessage(
      { store, gateway, isProduction: deps.isProduction },
      {
        actor: { organizationId: orgId, userId: null, actorType: "system" },
        organizationName,
        employee,
        threadId,
        message: callerText,
      },
    );
    replyText = result.assistantMessage.content;
    modelProviderSlug = result.assistantMessage.modelProviderSlug;
    modelId = result.assistantMessage.modelId;
    estimatedCostUsd = result.assistantMessage.estimatedCostUsd;
    resultSources = result.sources;
    sourceRefs = result.sources.map((s) => ({
      name: s.name,
      type: s.sourceType,
      preview: s.preview,
    }));
  } catch (error) {
    const reason: VoiceRejectReason =
      error instanceof ChatBlockedError && error.reason === "needs_dna"
        ? "needs_dna"
        : error instanceof ChatBlockedError && error.reason === "archived"
          ? "employee_unavailable"
          : "failed";
    await audit(store, channel, "voice_response.failed", { callSessionId: callSession.id, reason });
    await store.createVoiceStreamEvent({
      organizationId: orgId,
      employeeId: employee.id,
      channelId: channel.id,
      callSessionId: callSession.id,
      providerType: channel.channelProvider,
      eventType: "voice.response_failed",
      status: "failed",
      metadata: { reason },
    });
    return { status: "failed", reason, callerText, replyText: "", sources: [] };
  }

  // --- Employee text -> speech (TTS), no audio stored ----------------------
  const tts = getTtsProvider(voiceConfig.ttsProvider as TtsProviderType);
  await tts.synthesizeSpeech({ text: replyText, voiceStyle: voiceConfig.voiceStyle });

  if (saveTranscript) {
    await store.createVoiceTranscriptMessage({
      organizationId: orgId,
      employeeId: employee.id,
      channelId: channel.id,
      callSessionId: callSession.id,
      speakerType: "employee",
      content: replyText,
      sourceReferences: resultSources.length > 0 ? toTranscriptSources(resultSources) : null,
      modelProviderSlug,
      modelId,
      estimatedCostUsd,
    });
    await audit(store, channel, "voice_transcript.message_created", {
      callSessionId: callSession.id,
      speakerType: "employee",
    });
  }

  await audit(store, channel, "voice_response.generated", {
    callSessionId: callSession.id,
    providerSlug: modelProviderSlug,
    modelId,
  });
  await store.createVoiceStreamEvent({
    organizationId: orgId,
    employeeId: employee.id,
    channelId: channel.id,
    callSessionId: callSession.id,
    providerType: channel.channelProvider,
    eventType: "voice.response_generated",
    metadata: { retrievedSourceCount: sourceRefs.length },
  });
  await store.createVoiceStreamEvent({
    organizationId: orgId,
    employeeId: employee.id,
    channelId: channel.id,
    callSessionId: callSession.id,
    providerType: channel.channelProvider,
    eventType: "voice.response_played",
    metadata: {},
  });

  return { status: "answered", callerText, replyText, sources: sourceRefs };
}

/** End a call: finalize status/duration + record metadata-only events. */
export async function endVoiceCall(
  deps: VoiceRuntimeDeps,
  params: { channel: EmployeeChannel; callSession: VoiceCallSession; endReason: string },
): Promise<VoiceCallSession | null> {
  const { store } = deps;
  const { channel, callSession, endReason } = params;
  const ended = await store.endVoiceCallSession(channel.organizationId, callSession.id, endReason);
  await audit(store, channel, "voice_call.ended", {
    callSessionId: callSession.id,
    endReason,
  });
  await store.createVoiceStreamEvent({
    organizationId: channel.organizationId,
    employeeId: channel.employeeId,
    channelId: channel.id,
    callSessionId: callSession.id,
    providerType: channel.channelProvider,
    eventType: "call.ended",
    metadata: { endReason },
  });
  return ended;
}
