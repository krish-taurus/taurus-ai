"use client";

/**
 * Employee Chat conversation (Prompt 007).
 *
 * Renders the conversation and the message composer. Sending goes through the
 * sendChatMessageAction server action (Model Gateway only). No technical AI terms
 * are shown — sources are "sources", the brain is the "Employee Brain".
 */

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ChatSourceReference } from "@/lib/db/types";
import { sendChatMessageAction, type ChatActionState } from "@/modules/employee-chat/actions";
import { SOURCE_TYPE_LABELS } from "@/modules/employee-chat/metadata";
import { Badge, buttonClasses, Card, FieldError } from "@/components/ui";

export interface ChatMessageView {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: "sent" | "pending" | "failed";
  sourceReferences: ChatSourceReference[] | null;
  brainLabel: string | null;
  demo: boolean;
}

function SourceCards({ sources }: { sources: ChatSourceReference[] }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-taurus-faint">
        Sources used
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {sources.map((s) => (
          <div
            key={`${s.sourceId}-${s.documentId ?? "src"}`}
            className="rounded-lg border border-taurus-line bg-taurus-elevated p-3"
          >
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-taurus-text">{s.name}</span>
              <Badge tone="outline">{SOURCE_TYPE_LABELS[s.sourceType]}</Badge>
            </div>
            <p className="mt-1 line-clamp-3 text-xs text-taurus-faint">{s.preview}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessageView }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={isUser ? "max-w-[85%]" : "w-full max-w-[92%]"}>
        <div
          className={
            isUser
              ? "rounded-2xl rounded-br-sm bg-taurus-primary px-4 py-2.5 text-sm text-taurus-onPrimary"
              : "rounded-2xl rounded-bl-sm border border-taurus-line bg-taurus-surface px-4 py-2.5 text-sm text-taurus-text"
          }
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
          {!isUser && message.status === "failed" ? (
            <p className="mt-1 text-xs text-taurus-faint">This response could not be completed.</p>
          ) : null}
        </div>

        {!isUser && message.sourceReferences && message.sourceReferences.length > 0 ? (
          <SourceCards sources={message.sourceReferences} />
        ) : null}

        {!isUser && message.brainLabel ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-taurus-faint">
            <span>Answered by {message.brainLabel}</span>
            {message.demo ? <Badge tone="outline">Local demo mode</Badge> : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses("primary")}>
      {pending ? "Sending…" : "Send"}
    </button>
  );
}

function PendingReply() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-sm border border-taurus-line bg-taurus-surface px-4 py-2.5 text-sm text-taurus-faint">
        Thinking…
      </div>
    </div>
  );
}

export function ChatConversation({
  employeeId,
  employeeName,
  threadId,
  messages,
}: {
  employeeId: string;
  employeeName: string;
  threadId: string | null;
  messages: ChatMessageView[];
}) {
  const [state, formAction] = useFormState(sendChatMessageAction, {} as ChatActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Clear the composer after a successful send and scroll to the newest message.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <Card className="flex h-[calc(100vh-18rem)] min-h-[420px] flex-col p-0">
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <p className="text-sm text-taurus-text">
                Start a conversation with this AI Employee.
              </p>
              <p className="mt-1 text-xs text-taurus-faint">
                Ask {employeeName} a question to get started.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        <PendingReply />
        <div ref={endRef} />
      </div>

      <form ref={formRef} action={formAction} className="border-t border-taurus-line p-3">
        <input type="hidden" name="employeeId" value={employeeId} />
        {threadId ? <input type="hidden" name="threadId" value={threadId} /> : null}
        <div className="flex items-end gap-2">
          <textarea
            name="message"
            required
            rows={2}
            placeholder="Ask this AI Employee a question…"
            className="min-h-[44px] w-full resize-none rounded-lg border border-taurus-line bg-taurus-elevated px-3 py-2 text-sm text-taurus-text placeholder:text-taurus-faint focus:border-taurus-strong focus:outline-none"
          />
          <SendButton />
        </div>
        {state?.error ? (
          <div className="mt-2">
            <FieldError>{state.error}</FieldError>
          </div>
        ) : null}
      </form>
    </Card>
  );
}
