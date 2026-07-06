/** Fireworks provider adapter (Prompt 006B). Server-only; never called in tests. */
import { createOpenAiCompatibleProvider } from "@/modules/model-gateway/providers/openai-compatible";

export const fireworksProvider = createOpenAiCompatibleProvider(
  "fireworks",
  "https://api.fireworks.ai/inference/v1",
);
