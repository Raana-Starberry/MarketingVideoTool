import type { LLMCapabilities, LLMGenerationRequest, LLMProvider, LLMResult } from "../types";

/**
 * Real LLM provider backed by OpenAI's Responses API (`POST /v1/responses`),
 * used for story refinement and scene breakdown when OPENAI_API_KEY is set —
 * takes priority over the Gemini text provider once configured (see
 * registry.ts), since this is the one explicitly requested for story
 * generation.
 *
 * Auth: `Authorization: Bearer OPENAI_API_KEY`. Default model comes from
 * OpenAI's own quickstart docs as of 2026-09-09 (checked live rather than
 * assumed, since model names in this space change fast); override with
 * OPENAI_MODEL if that default is ever wrong for this account.
 */

const API_BASE = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-6-astra";

interface OpenAIOutputTextPart {
  type: "output_text";
  text: string;
}

interface OpenAIOutputMessage {
  type: "message";
  content: (OpenAIOutputTextPart | { type: string })[];
}

interface OpenAIResponse {
  output?: (OpenAIOutputMessage | { type: string })[];
  error?: { message: string };
}

export const openAILLMProvider: LLMProvider = {
  id: "openai-llm",
  name: "ChatGPT (OpenAI)",
  category: "llm",

  isConfigured: () => Boolean(process.env.OPENAI_API_KEY),

  getCapabilities(): LLMCapabilities {
    return { supportsJsonMode: true, maxOutputTokens: 32000 };
  },

  async generateText(req: LLMGenerationRequest): Promise<LLMResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

    const res = await fetch(`${API_BASE}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        input: req.prompt,
        ...(req.jsonMode ? { text: { format: { type: "json_object" } } } : {}),
        ...(req.maxOutputTokens ? { max_output_tokens: req.maxOutputTokens } : {}),
      }),
    });

    const body = (await res.json()) as OpenAIResponse;
    if (!res.ok) {
      throw new Error(body?.error?.message || `OpenAI request failed (${res.status})`);
    }

    const message = body.output?.find((o): o is OpenAIOutputMessage => o.type === "message");
    const textPart = message?.content.find((c): c is OpenAIOutputTextPart => c.type === "output_text");
    if (!textPart) {
      throw new Error("OpenAI response did not contain output text");
    }

    return { text: textPart.text };
  },
};
