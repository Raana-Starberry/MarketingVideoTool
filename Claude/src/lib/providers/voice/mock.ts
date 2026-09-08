import type { VoiceCapabilities, VoiceGenerationRequest, VoiceProvider, GenerationResult } from "../types";

const PLACEHOLDER_AUDIO =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";

export const mockVoiceProvider: VoiceProvider = {
  id: "mock-voice",
  name: "Mock Voice Provider",
  category: "voice",

  isConfigured: () => true,

  getCapabilities(): VoiceCapabilities {
    return {
      textToSpeech: true,
      voiceCloning: false,
      voiceLibrary: true,
      soundEffects: true,
      supportedLanguages: ["en"],
      maxTextLength: 5000,
    };
  },

  async generateSpeech(req: VoiceGenerationRequest): Promise<GenerationResult> {
    await new Promise((r) => setTimeout(r, 300));
    return {
      assets: [{ url: PLACEHOLDER_AUDIO, mimeType: "audio/mpeg" }],
      raw: { mock: true, text: req.text },
    };
  },
};
