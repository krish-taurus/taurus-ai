/**
 * Anthropic Claude provider adapter (Prompt 006B) — SERVER ONLY.
 *
 * Uses the Anthropic Messages API wire format (distinct from OpenAI's). Performs a
 * real network call and is NEVER invoked from tests or UI in this sprint.
 */

import type {
  LLMProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
} from "@/modules/model-gateway/types";

const DEFAULT_BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

export const anthropicProvider: LLMProvider = {
  slug: "anthropic",
  async generateText(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const baseUrl = (input.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");

    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: input.modelId,
        max_tokens: input.maxOutputTokens ?? 1024,
        ...(input.system ? { system: input.system } : {}),
        messages: input.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Provider anthropic returned ${response.status}.`);
    }

    const data = (await response.json()) as {
      id?: string;
      stop_reason?: string;
      content?: Array<{ type: string; text?: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
      };
    };

    const text = (data.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");

    return {
      text,
      inputTokens: data.usage?.input_tokens,
      cachedInputTokens: data.usage?.cache_read_input_tokens,
      outputTokens: data.usage?.output_tokens,
      rawProviderRequestId: data.id ?? null,
      finishReason: data.stop_reason ?? null,
    };
  },
};
