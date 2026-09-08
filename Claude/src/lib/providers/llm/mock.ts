import type { LLMCapabilities, LLMGenerationRequest, LLMProvider, LLMResult } from "../types";

/**
 * Instant, no-network LLM provider. The Scene Planner (src/lib/scene/planner.ts)
 * detects this provider by id and uses local heuristics instead of parsing
 * free-form JSON from it, so the story/scene-breakdown screens are fully
 * testable with zero API keys.
 */
export const mockLLMProvider: LLMProvider = {
  id: "mock-llm",
  name: "Mock LLM Provider",
  category: "llm",

  isConfigured: () => true,

  getCapabilities(): LLMCapabilities {
    return { supportsJsonMode: true, maxInputTokens: 100000, maxOutputTokens: 8000 };
  },

  async generateText(req: LLMGenerationRequest): Promise<LLMResult> {
    await new Promise((r) => setTimeout(r, 300));
    return { text: req.prompt.slice(0, 200) };
  },
};
