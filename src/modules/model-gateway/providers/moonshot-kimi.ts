/** Moonshot Kimi provider adapter (Prompt 006B). Server-only; never called in tests. */
import { createOpenAiCompatibleProvider } from "@/modules/model-gateway/providers/openai-compatible";

export const moonshotKimiProvider = createOpenAiCompatibleProvider(
  "moonshot_kimi",
  "https://api.moonshot.ai/v1",
);
