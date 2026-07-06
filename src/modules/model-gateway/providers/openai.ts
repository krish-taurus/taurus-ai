/** OpenAI provider adapter (Prompt 006B). Server-only; never called in tests. */
import { createOpenAiCompatibleProvider } from "@/modules/model-gateway/providers/openai-compatible";

export const openAiProvider = createOpenAiCompatibleProvider("openai", "https://api.openai.com/v1");
