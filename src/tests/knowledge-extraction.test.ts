// @vitest-environment node
// pdf-parse's bundled pdf.js runs in Node (the production/serverless runtime),
// not a browser DOM — so this suite must use the node environment, matching how
// extraction actually runs on the server.
import { describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// extraction.ts is server-only; neutralize the marker so it imports under vitest.
vi.mock("server-only", () => ({}));

import {
  extractFileText,
  extractUploadedFileText,
  htmlToText,
  fetchWebsiteText,
} from "@/modules/knowledge/extraction";

describe("knowledge extraction", () => {
  it("extracts UTF-8 text formats", async () => {
    const bytes = new TextEncoder().encode("Return policy: 30 days.");
    expect(await extractFileText(bytes, ".txt")).toEqual({
      text: "Return policy: 30 days.",
      status: "extracted",
    });
    expect((await extractFileText(new TextEncoder().encode('{"a":1}'), ".json")).status).toBe(
      "extracted",
    );
  });

  it("marks an unknown file type as unsupported", async () => {
    const res = await extractUploadedFileText("thing.exe", new Uint8Array([1, 2, 3]));
    expect(res.status).toBe("unsupported");
    expect(res.text).toBeNull();
  });

  it("returns failed for empty text", async () => {
    expect((await extractFileText(new Uint8Array(0), ".txt")).status).toBe("failed");
  });

  // Real PDF extraction against pdf-parse's own bundled sample (skips if absent).
  const pdfFixture = join(process.cwd(), "node_modules/pdf-parse/test/data/01-valid.pdf");
  it.skipIf(!existsSync(pdfFixture))("extracts text from a real PDF", async () => {
    const res = await extractFileText(new Uint8Array(readFileSync(pdfFixture)), ".pdf");
    expect(res.status).toBe("extracted");
    expect((res.text ?? "").length).toBeGreaterThan(50);
  });

  it("strips HTML to readable text and reads the title", () => {
    const { text, title } = htmlToText(
      "<html><head><title>Help &amp; FAQ</title><style>x{}</style></head>" +
        "<body><h1>Returns</h1><p>Within&nbsp;30 days.</p><script>ignore()</script></body></html>",
    );
    expect(title).toBe("Help & FAQ");
    expect(text).toContain("Returns");
    expect(text).toContain("Within 30 days.");
    expect(text).not.toContain("ignore()");
    expect(text).not.toContain("<");
  });

  it("blocks SSRF targets (localhost / private IPs / non-http) without fetching", async () => {
    for (const url of [
      "http://localhost:8080/",
      "http://127.0.0.1/admin",
      "http://169.254.169.254/latest/meta-data/",
      "http://192.168.1.1/",
      "ftp://example.com/file",
      "not a url",
    ]) {
      const res = await fetchWebsiteText(url);
      expect(res.status).toBe("failed");
      expect(res.text).toBeNull();
    }
  });
});
