/** Groq (Llama) provider adapter (Prompt 006B). Server-only; never called in tests. */
import { createOpenAiCompatibleProvider } from "@/modules/model-gateway/providers/openai-compatible";

export const groqProvider = createOpenAiCompatibleProvider(
  "groq",
  "https://api.groq.com/openai/v1",
);
