/**
 * Website widget script (Prompt 008).
 *
 * Served at /widget/taurus-widget.js. Dependency-free. Reads config from
 * window.TaurusAI, renders a floating launcher, and opens an iframe pointing at
 * the hosted /embed/[publicKey] surface. Contains NO secrets — the public key is
 * safe to embed. The app URL is injected at serve time so the iframe resolves
 * correctly regardless of where the script is embedded.
 */

import { NextResponse } from "next/server";
import { getClientEnv } from "@/lib/env/env";

export async function GET() {
  const appUrl = getClientEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  const script = `(function () {
  "use strict";
  var cfg = window.TaurusAI || {};
  var publicKey = cfg.channelId;
  if (!publicKey) {
    console.warn("[TaurusAI] Missing channelId in window.TaurusAI");
    return;
  }
  var APP_URL = ${JSON.stringify(appUrl)};
  var theme = cfg.theme === "light" ? "light" : "dark";
  var side = cfg.position === "bottom-left" ? "left" : "right";
  var launcherLabel = typeof cfg.launcherLabel === "string" ? cfg.launcherLabel : "Chat";
  var colors = theme === "light"
    ? { bg: "#ffffff", fg: "#111111", border: "#e5e5e5" }
    : { bg: "#111111", fg: "#ffffff", border: "#2a2a2a" };

  var open = false;
  var container = document.createElement("div");
  container.style.cssText = "position:fixed;bottom:20px;" + side + ":20px;z-index:2147483000;font-family:system-ui,-apple-system,sans-serif;";

  var frameWrap = document.createElement("div");
  frameWrap.style.cssText = "display:none;width:380px;max-width:calc(100vw - 40px);height:600px;max-height:calc(100vh - 120px);margin-bottom:12px;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.28);border:1px solid " + colors.border + ";background:" + colors.bg + ";";

  var iframe = document.createElement("iframe");
  iframe.src = APP_URL + "/embed/" + encodeURIComponent(publicKey);
  iframe.title = "Chat";
  iframe.style.cssText = "width:100%;height:100%;border:0;";
  iframe.setAttribute("loading", "lazy");
  frameWrap.appendChild(iframe);

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.setAttribute("aria-label", launcherLabel);
  launcher.textContent = launcherLabel;
  launcher.style.cssText = "cursor:pointer;border:1px solid " + colors.border + ";background:" + colors.bg + ";color:" + colors.fg + ";border-radius:9999px;padding:12px 18px;font-size:14px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.24);" + side + ":0;";

  launcher.addEventListener("click", function () {
    open = !open;
    frameWrap.style.display = open ? "block" : "none";
    launcher.textContent = open ? "Close" : launcherLabel;
  });

  container.appendChild(frameWrap);
  container.appendChild(launcher);

  function mount() { document.body.appendChild(container); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
`;

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
