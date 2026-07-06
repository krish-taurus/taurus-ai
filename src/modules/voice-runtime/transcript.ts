/**
 * Voice transcript helpers (Prompt 010).
 *
 * Maps chat source references to safe public refs and summarizes a call. The
 * transcript is the ONLY place caller/employee speech is stored; audit + stream
 * events never carry transcript content.
 */

import type { ChatSourceReference, VoiceCallSession, VoiceTranscriptMessage } from "@/lib/db/types";

/** Only name/type/preview cross into transcript source refs — never internal ids. */
export function toTranscriptSources(sources: ChatSourceReference[]): ChatSourceReference[] {
  return sources.map((s) => ({
    sourceId: "",
    name: s.name,
    sourceType: s.sourceType,
    documentId: null,
    preview: s.preview,
  }));
}

export interface CallSummary {
  callId: string;
  status: VoiceCallSession["status"];
  durationSeconds: number | null;
  turnCount: number;
  callerTurns: number;
  employeeTurns: number;
}

export function summarizeCall(
  call: VoiceCallSession,
  transcript: VoiceTranscriptMessage[],
): CallSummary {
  return {
    callId: call.id,
    status: call.status,
    durationSeconds: call.durationSeconds,
    turnCount: transcript.length,
    callerTurns: transcript.filter((m) => m.speakerType === "caller").length,
    employeeTurns: transcript.filter((m) => m.speakerType === "employee").length,
  };
}
