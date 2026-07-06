/**
 * Default provider registry (Prompt 006B).
 *
 * Maps each provider slug to its adapter. These adapters make real network calls
 * and are only ever reached through the gateway on the server — never in tests
 * (which inject fakes) and never from any UI in this sprint.
 */

import type { LLMProvider } from "@/modules/model-gateway/types";
import type { ProviderSlug } from "@/lib/db/types";
import { openAiProvider } from "@/modules/model-gateway/providers/openai";
import { anthropicProvider } from "@/modules/model-gateway/providers/anthropic";
import { deepSeekProvider } from "@/modules/model-gateway/providers/deepseek";
import { moonshotKimiProvider } from "@/modules/model-gateway/providers/moonshot-kimi";
import { groqProvider } from "@/modules/model-gateway/providers/groq";
import { googleGeminiProvider } from "@/modules/model-gateway/providers/google-gemini";
import { fireworksProvider } from "@/modules/model-gateway/providers/fireworks";
import { customOpenAiCompatibleProvider } from "@/modules/model-gateway/providers/custom-openai-compatible";

export const DEFAULT_PROVIDERS: Record<ProviderSlug, LLMProvider> = {
  openai: openAiProvider,
  anthropic: anthropicProvider,
  deepseek: deepSeekProvider,
  moonshot_kimi: moonshotKimiProvider,
  groq: groqProvider,
  google_gemini: googleGeminiProvider,
  fireworks: fireworksProvider,
  custom_openai_compatible: customOpenAiCompatibleProvider,
};
