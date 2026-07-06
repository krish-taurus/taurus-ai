import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join, extname } from "path";

/**
 * Acceptance criterion (Prompt 001): user-facing UI must not use the words
 * "agent", "prompt", or "knowledge base".
 *
 * This test scans the UI source (src/app + src/components), strips comments so
 * developer notes don't trip it, and fails if any forbidden term survives in
 * code or visible copy.
 */

const uiRoot = join(process.cwd(), "src");
const UI_DIRS = [join(uiRoot, "app"), join(uiRoot, "components")];

const FORBIDDEN: { label: string; pattern: RegExp }[] = [
  { label: "agent", pattern: /\bagents?\b/i },
  { label: "prompt", pattern: /\bprompts?\b/i },
  { label: "knowledge base", pattern: /knowledge\s+base/i },
  // Prompt 006: Knowledge Vault must not leak technical retrieval terms.
  { label: "embedding", pattern: /\bembeddings?\b/i },
  { label: "vector", pattern: /\bvectors?\b/i },
  { label: "chunk", pattern: /\bchunks?\b/i },
  { label: "RAG", pattern: /\bRAG\b/ },
  { label: "retriever", pattern: /\bretrievers?\b/i },
  // Prompt 007: Employee Chat must not leak raw model terminology.
  { label: "LLM", pattern: /\bLLMs?\b/ },
];

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full));
    } else if ([".ts", ".tsx"].includes(extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/** Remove block comments and full-line // comments so notes are ignored. */
function stripComments(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, " ");
  return withoutBlocks
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

describe("Taurus terminology in the user-facing UI", () => {
  const files = UI_DIRS.flatMap(collectFiles);

  it("finds UI source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const { label, pattern } of FORBIDDEN) {
    it(`does not use the word "${label}"`, () => {
      const offenders = files.filter((file) =>
        pattern.test(stripComments(readFileSync(file, "utf8"))),
      );
      expect(offenders, `Forbidden term "${label}" found in: ${offenders.join(", ")}`).toEqual([]);
    });
  }
});
