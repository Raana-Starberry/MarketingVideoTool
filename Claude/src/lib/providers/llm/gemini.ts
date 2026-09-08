import type { LLMCapabilities, LLMGenerationRequest, LLMProvider, LLMResult } from "../types";

/**
 * Real LLM provider backed by Gemini's text model, reusing GEMINI_API_KEY —
 * the same credential already used for image generation. Verified against
 * the live API on 2026-09-08 (gemini-2.5-flash is not available to this
 * project; gemini-3.6-flash is the confirmed-working replacement).
 */

const MODEL = "gemini-3.6-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const geminiLLMProvider: LLMProvider = {
  id: "gemini-llm",
  name: "Gemini (text)",
  category: "llm",

  isConfigured: () => Boolean(process.env.GEMINI_API_KEY),

  getCapabilities(): LLMCapabilities {
    return { supportsJsonMode: true, maxInputTokens: 1000000, maxOutputTokens: 65536 };
  },

  async generateText(req: LLMGenerationRequest): Promise<LLMResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

    const res = await fetch(`${API_BASE}/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: req.prompt }] }],
        generationConfig: {
          ...(req.jsonMode ? { responseMimeType: "application/json" } : {}),
          ...(req.maxOutputTokens ? { maxOutputTokens: req.maxOutputTokens } : {}),
        },
      }),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error?.message || `Gemini text generation failed (${res.status})`);
    }

    const text = body?.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text;
    if (typeof text !== "string") {
      throw new Error("Gemini response did not contain text");
    }

    return { text };
  },
};
