"use client";

/**
 * WhatsApp Embedded Signup launcher (Sprint 041).
 *
 * Loads Meta's JS SDK and runs the hosted Embedded Signup popup, then posts the
 * returned code + phone number id to our exchange endpoint, which finishes the
 * connection server-side. Rendered only when the Meta app is configured.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClasses, FieldError } from "@/components/ui";

const GRAPH_VERSION = "v20.0";

// Minimal shape of the global injected by Meta's SDK.
interface FbSdk {
  init(opts: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void;
  login(
    cb: (resp: { authResponse?: { code?: string } | null }) => void,
    opts: Record<string, unknown>,
  ): void;
}
declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

export function WhatsAppConnect({
  appId,
  configId,
  employeeId,
}: {
  appId: string;
  configId: string;
  employeeId: string;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phoneNumberId = useRef<string | null>(null);

  // Load the SDK once and capture the phone_number_id from the signup session.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
        return;
      }
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP" && data?.data?.phone_number_id) {
          phoneNumberId.current = String(data.data.phone_number_id);
        }
      } catch {
        /* non-JSON message — ignore */
      }
    }
    window.addEventListener("message", onMessage);

    if (window.FB) {
      setReady(true);
    } else {
      window.fbAsyncInit = () => {
        window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: GRAPH_VERSION });
        setReady(true);
      };
      const s = document.createElement("script");
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.async = true;
      s.defer = true;
      document.body.appendChild(s);
    }
    return () => window.removeEventListener("message", onMessage);
  }, [appId]);

  const connect = useCallback(() => {
    if (!window.FB) return;
    setError(null);
    setBusy(true);
    phoneNumberId.current = null;
    window.FB.login(
      async (resp) => {
        const code = resp?.authResponse?.code;
        if (!code) {
          setBusy(false);
          setError("The WhatsApp connection was cancelled.");
          return;
        }
        try {
          const res = await fetch("/api/channels/whatsapp/exchange", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ employeeId, code, phoneNumberId: phoneNumberId.current }),
          });
          const body = (await res.json()) as { ok?: boolean; error?: string };
          if (!res.ok || !body.ok) {
            setError(body.error ?? "Could not finish connecting WhatsApp. Please try again.");
            setBusy(false);
            return;
          }
          router.refresh();
        } catch {
          setError("Could not reach the server. Please try again.");
          setBusy(false);
        }
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, sessionInfoVersion: "3" },
      },
    );
  }, [configId, employeeId, router]);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={connect}
        disabled={!ready || busy}
        className={buttonClasses("primary")}
      >
        {busy ? "Connecting…" : "Connect WhatsApp"}
      </button>
      {!ready ? <p className="text-xs text-taurus-faint">Loading Meta&apos;s secure connect…</p> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
