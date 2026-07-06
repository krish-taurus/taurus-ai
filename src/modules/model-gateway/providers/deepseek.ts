/** DeepSeek provider adapter (Prompt 006B). Server-only; never called in tests. */
import { createOpenAiCompatibleProvider } from "@/modules/model-gateway/providers/openai-compatible";

export const deepSeekProvider = createOpenAiCompatibleProvider(
  "deepseek",
  "https://api.deepseek.com/v1",
);
