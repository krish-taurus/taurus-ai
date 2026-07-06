/**
 * Google Gemini provider adapter (Prompt 006B) — SERVER ONLY.
 *
 * Uses the Generative Language generateContent wire format. Performs a real
 * network call and is NEVER invoked from tests or UI in this sprint.
 */

import type {
  LLMProvider,
  ProviderGenerateInput,
  ProviderGenerateResult,
} from "@/modules/model-gateway/types";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export const googleGeminiProvider: LLMProvider = {
  slug: "google_gemini",
  async generateText(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const baseUrl = (input.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    const url = `${baseUrl}/models/${encodeURIComponent(input.modelId)}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify({
        ...(input.system ? { systemInstruction: { parts: [{ text: input.system }] } } : {}),
        contents: input.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        ...(input.maxOutputTokens
          ? { generationConfig: { maxOutputTokens: input.maxOutputTokens } }
          : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`Provider google_gemini returned ${response.status}.`);
    }

    const data = (await response.json()) as {
      responseId?: string;
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: Array<{ text?: string }> };
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        cachedContentTokenCount?: number;
      };
    };

    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("");

    return {
      text,
      inputTokens: data.usageMetadata?.promptTokenCount,
      cachedInputTokens: data.usageMetadata?.cachedContentTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
      rawProviderRequestId: data.responseId ?? null,
      finishReason: data.candidates?.[0]?.finishReason ?? null,
    };
  },
};
