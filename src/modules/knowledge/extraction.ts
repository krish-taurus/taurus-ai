import "server-only";

/**
 * Knowledge Vault content extraction (Sprint 021).
 *
 * Turns an uploaded file or a website URL into plain text the Knowledge Vault can
 * index and answer from. Previously PDFs/DOCX were stored without their text and
 * website URLs were never fetched, so AI Employees had nothing to ground on —
 * this module fills that gap.
 *
 * Server-only: uses Node libraries (pdf-parse, mammoth) and outbound fetch. The
 * website fetch is SSRF-guarded — only http/https, and every hop must resolve to
 * a public IP (blocks localhost, private ranges, and cloud metadata endpoints).
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getAllowedFileType } from "@/modules/knowledge/metadata";
import type { DocumentExtractionStatus } from "@/lib/db/types";

type PdfParseFn = (
  data: Buffer,
  options?: Record<string, unknown>,
) => Promise<{ text: string }>;

/**
 * Load pdf-parse's internal lib entrypoint (skips the debug harness in index.js),
 * tolerating both CJS (`module.exports = fn`) and ESM-interop (`{ default: fn }`)
 * shapes across Node / Next / test runtimes.
 */
async function loadPdfParse(): Promise<PdfParseFn> {
  const mod = (await import("pdf-parse/lib/pdf-parse.js")) as unknown as
    | PdfParseFn
    | { default: PdfParseFn };
  return typeof mod === "function" ? mod : mod.default;
}

export interface ExtractedText {
  text: string | null;
  status: DocumentExtractionStatus;
}

const MIN_USEFUL_CHARS = 1;

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/** Extract text from an uploaded file's bytes based on its extension. */
export async function extractFileText(
  bytes: Uint8Array,
  extension: string,
): Promise<ExtractedText> {
  const ext = extension.toLowerCase();
  try {
    if ([".txt", ".md", ".csv", ".json"].includes(ext)) {
      const text = decodeUtf8(bytes).trim();
      return text.length >= MIN_USEFUL_CHARS
        ? { text, status: "extracted" }
        : { text: null, status: "failed" };
    }
    if (ext === ".pdf") {
      const pdfParse = await loadPdfParse();
      const result = await pdfParse(Buffer.from(bytes));
      const text = (result.text ?? "").trim();
      return text.length >= MIN_USEFUL_CHARS
        ? { text, status: "extracted" }
        : { text: null, status: "failed" };
    }
    if (ext === ".docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      const text = (result.value ?? "").trim();
      return text.length >= MIN_USEFUL_CHARS
        ? { text, status: "extracted" }
        : { text: null, status: "failed" };
    }
    return { text: null, status: "unsupported" };
  } catch {
    // A corrupt/scanned file that can't be read shouldn't fail the upload — the
    // source is still saved, just flagged as not readable.
    return { text: null, status: "failed" };
  }
}

/** Convenience wrapper: resolve a filename to its type, then extract. */
export async function extractUploadedFileText(
  filename: string,
  bytes: Uint8Array,
): Promise<ExtractedText> {
  const type = getAllowedFileType(filename);
  if (!type) return { text: null, status: "unsupported" };
  return extractFileText(bytes, type.extension);
}

/* -------------------------------------------------------------------------- */
/* Website fetching (SSRF-guarded)                                            */
/* -------------------------------------------------------------------------- */

export interface FetchedWebsite {
  text: string | null;
  title: string | null;
  status: DocumentExtractionStatus;
}

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 3 * 1024 * 1024; // 3 MB of HTML
const MAX_TEXT_CHARS = 200_000;
const MAX_REDIRECTS = 3;

/** True for loopback / private / link-local / unique-local IPs (SSRF targets). */
function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split(".").map(Number);
    if (p[0] === 10) return true;
    if (p[0] === 127) return true;
    if (p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true; // link-local (cloud metadata)
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] >= 224) return true; // multicast / reserved
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
    if (lower.startsWith("::ffff:")) return isPrivateIp(lower.slice(7)); // IPv4-mapped
    return false;
  }
  return true; // couldn't parse → treat as unsafe
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https website addresses are supported.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That website address is not reachable.");
  }
  // Resolve DNS and reject any private/loopback/link-local address.
  const literal = isIP(host);
  const addresses = literal
    ? [host]
    : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateIp)) {
    throw new Error("That website address is not reachable.");
  }
}

/** Strip HTML to readable text; also pull the <title>. Dependency-free. */
export function htmlToText(html: string): { text: string; title: string | null } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim() : null;

  let out = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|br|header|footer|main)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  out = decodeEntities(out)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/gm, "")
    .trim();
  if (out.length > MAX_TEXT_CHARS) out = out.slice(0, MAX_TEXT_CHARS);
  return { text: out, title };
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    "#39": "'",
  };
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9]+);/gi, (m, name) => named[name.toLowerCase()] ?? m);
}

/** Fetch a website and extract its readable text. SSRF-guarded, size/time-capped. */
export async function fetchWebsiteText(rawUrl: string): Promise<FetchedWebsite> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    return { text: null, title: null, status: "failed" };
  }

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await assertPublicUrl(current);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(current.toString(), {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: { "user-agent": "TaurusAI-KnowledgeBot/1.0", accept: "text/html,*/*" },
        });
      } finally {
        clearTimeout(timer);
      }

      // Follow one redirect at a time, re-validating each hop against SSRF.
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return { text: null, title: null, status: "failed" };
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) return { text: null, title: null, status: "failed" };

      const buf = new Uint8Array(await response.arrayBuffer());
      const html = decodeUtf8(buf.slice(0, MAX_BYTES));
      const { text, title } = htmlToText(html);
      return text.length >= MIN_USEFUL_CHARS
        ? { text, title, status: "extracted" }
        : { text: null, title, status: "failed" };
    }
    return { text: null, title: null, status: "failed" };
  } catch {
    return { text: null, title: null, status: "failed" };
  }
}
