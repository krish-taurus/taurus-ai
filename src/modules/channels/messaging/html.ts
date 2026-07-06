/**
 * Safe email text extraction (Prompt 009).
 *
 * Inbound email HTML is NEVER rendered. We strip tags to a plain-text preview so
 * the AI Employee (and the dashboard) only ever see safe text. This is a
 * deliberately conservative, dependency-free stripper.
 */

/** Convert HTML to a safe plain-text string (no tags, no scripts, no entities). */
export function htmlToSafeText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Prefer plain text; fall back to a stripped, safe preview of HTML. */
export function preferPlainText(text: string | undefined, html: string | undefined): string {
  const plain = (text ?? "").trim();
  if (plain) return plain;
  if (html) return htmlToSafeText(html);
  return "";
}
