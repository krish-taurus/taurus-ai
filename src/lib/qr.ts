import "server-only";

/**
 * QR rendering (Sprint 037) — server only.
 *
 * Renders text (a "reach me" URL) to a self-contained SVG string using the
 * `qrcode` library. The SVG is generated from our own data and inlined into the
 * page — no external image request, so it works offline and under a strict CSP.
 */

import QRCode from "qrcode";

/** Render `text` to an inline SVG QR code. Returns null on failure (never throws). */
export async function renderQrSvg(text: string): Promise<string | null> {
  try {
    return await QRCode.toString(text, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      // Colors are overridden by CSS (currentColor) in the display component.
      color: { dark: "#000000", light: "#00000000" },
    });
  } catch {
    return null;
  }
}
