/**
 * Custom OpenAI-compatible provider adapter (Prompt 006B). Server-only.
 *
 * Used for self-hosted / enterprise OpenAI-compatible endpoints. The base URL is
 * supplied per request (no default). Never called in tests.
 */
import { createOpenAiCompatibleProvider } from "@/modules/model-gateway/providers/openai-compatible";

export const customOpenAiCompatibleProvider = createOpenAiCompatibleProvider(
  "custom_openai_compatible",
  null,
);
