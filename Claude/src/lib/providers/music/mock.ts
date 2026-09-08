import type { MusicCapabilities, MusicGenerationRequest, MusicProvider, GenerationResult } from "../types";

const PLACEHOLDER_MUSIC =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";

export const mockMusicProvider: MusicProvider = {
  id: "mock-music",
  name: "Mock Music Provider",
  category: "music",

  isConfigured: () => true,

  getCapabilities(): MusicCapabilities {
    return {
      textToMusic: true,
      durationControl: true,
      genreControl: true,
      maxDurationSeconds: 180,
    };
  },

  async generateMusic(req: MusicGenerationRequest): Promise<GenerationResult> {
    await new Promise((r) => setTimeout(r, 300));
    return {
      assets: [
        {
          url: PLACEHOLDER_MUSIC,
          durationMs: req.durationSeconds * 1000,
          mimeType: "audio/mpeg",
        },
      ],
      raw: { mock: true, prompt: req.prompt },
    };
  },
};
