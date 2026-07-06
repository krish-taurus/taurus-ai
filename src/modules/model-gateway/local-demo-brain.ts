/**
 * Local Demo Brain (Prompt 007).
 *
 * A deterministic, offline model used ONLY for local development and tests, and
 * ONLY through the Model Gateway (never called from chat/knowledge code, and
 * never used silently in production). It produces a safe, grounded-sounding
 * answer from the retrieved Knowledge Vault excerpts that the runtime context
 * builder places in the system instructions — or clearly says when it has no
 * approved company knowledge to answer from.
 *
 * The heading constants below are the contract between the runtime context
 * builder (which formats excerpts) and this demo brain (which reads them). Chat
 * code depends on the gateway, not the other way around, so the constants live
 * here.
 */

import type { ProviderGenerateInput, ProviderGenerateResult } from "@/modules/model-gateway/types";

/** Heading under which the runtime context lists assigned excerpts. */
export const KNOWLEDGE_EXCERPTS_HEADING = "ASSIGNED KNOWLEDGE VAULT EXCERPTS:";
/** Marker the context builder uses when no excerpts are available. */
export const NO_EXCERPTS_MARKER = "(none available)";

/** Human label surfaced in message metadata / UI when the demo brain answered. */
export const LOCAL_DEMO_BRAIN_LABEL = "Local demo brain";

function lastUserMessage(input: ProviderGenerateInput): string {
  for (let i = input.messages.length - 1; i >= 0; i -= 1) {
    if (input.messages[i].role === "user") return input.messages[i].content.trim();
  }
  return "";
}

/** Extract the first one or two excerpt lines ("[n] Title: preview") from system. */
function firstExcerpts(system: string, limit = 2): string[] {
  const lines = system.split("\n");
  const excerpts: string[] = [];
  for (const line of lines) {
    if (/^\s*\[\d+\]\s+/.test(line)) {
      excerpts.push(line.trim());
      if (excerpts.length >= limit) break;
    }
  }
  return excerpts;
}

function hasKnowledge(system: string | null): boolean {
  if (!system) return false;
  if (!system.includes(KNOWLEDGE_EXCERPTS_HEADING)) return false;
  if (system.includes(NO_EXCERPTS_MARKER)) return false;
  return firstExcerpts(system, 1).length > 0;
}

/**
 * Deterministic demo answer. No randomness, no clock, no network. Grounds its
 * reply in the provided excerpts, or admits it lacks approved knowledge.
 */
export function generateLocalDemoAnswer(input: ProviderGenerateInput): ProviderGenerateResult {
  const question = lastUserMessage(input);
  const grounded = hasKnowledge(input.system);

  let text: string;
  if (!question) {
    text = "Hello — how can I help you today? Ask me a question and I'll do my best to help.";
  } else if (grounded) {
    const excerpts = firstExcerpts(input.system ?? "");
    const grounding = excerpts.map((e) => `• ${e.replace(/^\s*\[\d+\]\s+/, "")}`).join("\n");
    text =
      `Here's what I found in the Knowledge Vault sources assigned to me:\n\n${grounding}\n\n` +
      `If you'd like more detail on this, let me know and I can point you to the relevant source.`;
  } else {
    text =
      "I don't have enough approved company knowledge assigned to me to answer that " +
      "confidently yet. If this needs company-specific information, please assign the " +
      "relevant Knowledge Vault sources and I'll give you a grounded answer.";
  }

  return { text, finishReason: "stop", rawProviderRequestId: null };
}
