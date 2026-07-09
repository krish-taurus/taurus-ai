"use client";

/**
 * Public chat surface (Prompt 008).
 *
 * Used by the hosted chat page and the iframe embed. Talks to the public message
 * API (no dashboard auth). Dependency-free, premium monochrome. Shows sources
 * only when the channel allows it. No technical AI terms are shown.
 */

import { useEffect, useRef, useState } from "react";
import type { KnowledgeSourceType } from "@/lib/db/types";

interface PublicSource {
  name: string;
  type: KnowledgeSourceType;
  preview: string;
}

interface PublicMessage {
  role: "user" | "assistant";
  text: string;
  sources?: PublicSource[];
  demo?: boolean;
}

const SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  text: "Note",
  file: "Document",
  url: "Website",
  database: "Database",
  google_drive: "Google Drive",
  cloud_storage: "Cloud storage",
};

export function PublicChat({
  publicKey,
  employeeName,
  roleTitle,
  welcomeMessage,
  showSources,
  variant = "page",
}: {
  publicKey: string;
  employeeName: string;
  roleTitle: string;
  welcomeMessage: string;
  showSources: boolean;
  variant?: "page" | "embed";
}) {
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const storageKey = `taurus_session_${publicKey}`;

  useEffect(() => {
    try {
      sessionRef.current = window.localStorage.getItem(storageKey);
    } catch {
      sessionRef.current = null;
    }
  }, [storageKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/public/channels/${encodeURIComponent(publicKey)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sessionRef.current, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Something went wrong.");
        return;
      }
      if (data.sessionId) {
        sessionRef.current = data.sessionId;
        try {
          window.localStorage.setItem(storageKey, data.sessionId);
        } catch {
          /* ignore storage errors */
        }
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: String(data.message ?? ""),
          sources: Array.isArray(data.sources) ? data.sources : [],
          demo: Boolean(data?.metadata?.demoMode),
        },
      ]);
    } catch {
      setError("Could not reach the chat. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-taurus-app text-taurus-text">
      <header className="border-b border-taurus-line px-5 py-4">
        <p className="text-sm font-semibold text-taurus-text">{employeeName}</p>
        <p className="text-xs text-taurus-faint">{roleTitle}</p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="flex justify-start">
          <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-taurus-line bg-taurus-surface px-4 py-2.5 text-sm">
            {welcomeMessage}
          </div>
        </div>

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-taurus-primary px-4 py-2.5 text-sm text-taurus-onPrimary"
                  : "w-full max-w-[92%] rounded-2xl rounded-bl-sm border border-taurus-line bg-taurus-surface px-4 py-2.5 text-sm"
              }
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.role === "assistant" && showSources && m.sources && m.sources.length > 0 ? (
                <div className="mt-3 space-y-2 border-t border-taurus-line pt-3">
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-taurus-faint">
                    Sources used
                  </p>
                  {m.sources.map((s, si) => (
                    <div
                      key={si}
                      className="rounded-lg border border-taurus-line bg-taurus-elevated p-2.5"
                    >
                      <p className="text-xs font-medium text-taurus-text">
                        {s.name}{" "}
                        <span className="font-normal text-taurus-faint">
                          · {SOURCE_TYPE_LABELS[s.type]}
                        </span>
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-taurus-faint">{s.preview}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {m.role === "assistant" && m.demo ? (
                <p className="mt-1.5 text-[11px] text-taurus-faint">Local demo mode</p>
              ) : null}
            </div>
          </div>
        ))}

        {loading ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-taurus-line bg-taurus-surface px-4 py-2.5 text-sm text-taurus-faint">
              Thinking…
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="border-t border-taurus-line p-3">
        {error ? (
          <p
            role="alert"
            className="mb-2 rounded-lg border border-taurus-strong bg-taurus-muted px-3 py-2 text-xs text-taurus-text"
          >
            {error}
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={variant === "embed" ? 1 : 2}
            placeholder="Type your message…"
            className="min-h-[44px] w-full resize-none rounded-lg border border-taurus-line bg-taurus-elevated px-3 py-2 text-sm text-taurus-text placeholder:text-taurus-faint focus:border-taurus-strong focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as React.FormEvent);
              }
            }}
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-taurus-primary px-4 py-2 text-sm font-semibold text-taurus-onPrimary disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
