"use client";

/**
 * Simulate Phone Call panel (Prompt 010).
 *
 * An interactive local test: start a call, send caller utterances, watch the AI
 * Employee reply, and end the call. Runs through the real voice runtime in
 * simulated mode — no telephony, no audio. Shows the call transcript live.
 */

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  simulateEndCallAction,
  simulateStartCallAction,
  simulateUtteranceAction,
  type VoiceActionState,
} from "@/modules/voice-runtime/actions";
import { Badge, buttonClasses, Card, Field, FieldError, Input, Notice } from "@/components/ui";

interface Line {
  speaker: "caller" | "employee";
  text: string;
  sources?: { name: string; type: string; preview: string }[];
}

function PendingButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary")}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function SimulateCallPanel({
  employeeId,
  channelId,
  canSimulate,
}: {
  employeeId: string;
  channelId: string;
  canSimulate: boolean;
}) {
  const [startState, startAction] = useFormState(simulateStartCallAction, {} as VoiceActionState);
  const [uttState, uttAction] = useFormState(simulateUtteranceAction, {} as VoiceActionState);
  const [endState, endAction] = useFormState(simulateEndCallAction, {} as VoiceActionState);

  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [ended, setEnded] = useState(false);
  const uttFormRef = useRef<HTMLFormElement>(null);
  const lastStart = useRef<VoiceActionState | null>(null);
  const lastUtt = useRef<VoiceActionState | null>(null);
  const lastEnd = useRef<VoiceActionState | null>(null);

  useEffect(() => {
    if (startState === lastStart.current) return;
    lastStart.current = startState;
    if (startState.ok && startState.callSessionId) {
      setCallSessionId(startState.callSessionId);
      setEnded(false);
      setLines(startState.greeting ? [{ speaker: "employee", text: startState.greeting }] : []);
    }
  }, [startState]);

  useEffect(() => {
    if (uttState === lastUtt.current) return;
    lastUtt.current = uttState;
    if (uttState.ok && uttState.callerText !== undefined) {
      setLines((prev) => [
        ...prev,
        { speaker: "caller", text: uttState.callerText ?? "" },
        { speaker: "employee", text: uttState.replyText ?? "", sources: uttState.sources },
      ]);
      uttFormRef.current?.reset();
    }
  }, [uttState]);

  useEffect(() => {
    if (endState === lastEnd.current) return;
    lastEnd.current = endState;
    if (endState.ended) setEnded(true);
  }, [endState]);

  if (!canSimulate) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-taurus-text">Simulate Phone Call</h3>
        <p className="mt-2 text-xs text-taurus-faint">
          Activate the Voice Channel and publish Employee DNA to run a simulated call.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-taurus-text">Simulate Phone Call</h3>
        <Badge tone="outline">Simulated</Badge>
      </div>

      {!callSessionId ? (
        <form action={startAction} className="space-y-3">
          <input type="hidden" name="channelId" value={channelId} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Caller number" htmlFor="from">
              <Input id="from" name="from" placeholder="+15551234567" maxLength={40} />
            </Field>
            <Field label="Caller name" htmlFor="name" optional>
              <Input id="name" name="name" maxLength={120} />
            </Field>
          </div>
          {startState?.error ? <FieldError>{startState.error}</FieldError> : null}
          <PendingButton label="Start simulated call" pendingLabel="Starting…" />
        </form>
      ) : (
        <div className="space-y-4">
          <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-taurus-line bg-taurus-app p-4">
            {lines.map((l, i) => (
              <div
                key={i}
                className={l.speaker === "caller" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    l.speaker === "caller"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-taurus-primary px-3.5 py-2 text-sm text-taurus-onPrimary"
                      : "max-w-[92%] rounded-2xl rounded-bl-sm border border-taurus-line bg-taurus-surface px-3.5 py-2 text-sm text-taurus-text"
                  }
                >
                  <p className="mb-0.5 text-[10px] uppercase tracking-[0.1em] opacity-70">
                    {l.speaker === "caller" ? "Caller" : "AI Employee"}
                  </p>
                  <p className="whitespace-pre-wrap">{l.text}</p>
                  {l.sources && l.sources.length > 0 ? (
                    <p className="mt-1.5 text-[11px] text-taurus-faint">
                      Sources: {l.sources.map((s) => s.name).join(", ")}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {ended ? (
            <Notice>Call ended. The transcript has been saved to Recent calls.</Notice>
          ) : (
            <form ref={uttFormRef} action={uttAction} className="space-y-2">
              <input type="hidden" name="channelId" value={channelId} />
              <input type="hidden" name="callSessionId" value={callSessionId} />
              <Field label="Caller says" htmlFor="text">
                <Input
                  id="text"
                  name="text"
                  placeholder="What's your return policy?"
                  maxLength={2000}
                />
              </Field>
              {uttState?.error ? <FieldError>{uttState.error}</FieldError> : null}
              <div className="flex flex-wrap items-center gap-2">
                <PendingButton label="Send" pendingLabel="Thinking…" />
              </div>
            </form>
          )}

          {!ended ? (
            <form action={endAction}>
              <input type="hidden" name="channelId" value={channelId} />
              <input type="hidden" name="callSessionId" value={callSessionId} />
              <input type="hidden" name="employeeId" value={employeeId} />
              <button type="submit" className={buttonClasses("secondary", "sm")}>
                End call
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCallSessionId(null);
                setLines([]);
                setEnded(false);
              }}
              className={buttonClasses("secondary", "sm")}
            >
              Start a new call
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
