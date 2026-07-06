/**
 * Shared OpenAI-compatible provider adapter (Prompt 006B) — SERVER ONLY.
 *
 * Many providers (OpenAI, DeepSeek, Kimi, Groq, Fireworks, custom) speak the same
 * /chat/completions wire format, so they share this implementation. Anthropic and
 * Gemini have their own adapters.
 *
 * NOTE: This performs a real network call and is NEVER invoked from tests or from
 * any UI in this sprint. The gateway is foundation-only; product code consumes the
 * gateway, not this adapter, and tests inject fakes.
 */

import type {
  LLMProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
} from "@/modules/model-gateway/types";
import type { ProviderSlug } from "@/lib/db/types";

export function createOpenAiCompatibleProvider(
  slug: ProviderSlug,
  fallbackBaseUrl: string | null,
): LLMProvider {
  return {
    slug,
    async generateText(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
      const baseUrl = input.baseUrl ?? fallbackBaseUrl;
      if (!baseUrl) throw new Error(`No base URL configured for provider ${slug}.`);

      const messages = [
        ...(input.system ? [{ role: "system", content: input.system }] : []),
        ...input.messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${input.apiKey}`,
        },
        body: JSON.stringify({
          model: input.modelId,
          messages,
          ...(input.maxOutputTokens ? { max_tokens: input.maxOutputTokens } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error(`Provider ${slug} returned ${response.status}.`);
      }

      const data = (await response.json()) as {
        id?: string;
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          prompt_tokens_details?: { cached_tokens?: number };
        };
      };

      return {
        text: data.choices?.[0]?.message?.content ?? "",
        inputTokens: data.usage?.prompt_tokens,
        cachedInputTokens: data.usage?.prompt_tokens_details?.cached_tokens,
        outputTokens: data.usage?.completion_tokens,
        rawProviderRequestId: data.id ?? null,
        finishReason: data.choices?.[0]?.finish_reason ?? null,
      };
    },
  };
}
