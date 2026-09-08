import type { LipSyncCapabilities, LipSyncGenerationRequest, LipSyncProvider, GenerationResult } from "../types";

export const mockLipSyncProvider: LipSyncProvider = {
  id: "mock-lipsync",
  name: "Mock Lip Sync Provider",
  category: "lip-sync",

  isConfigured: () => true,

  getCapabilities(): LipSyncCapabilities {
    return { standaloneSync: true, maxDurationSeconds: 60 };
  },

  async generate(req: LipSyncGenerationRequest): Promise<GenerationResult> {
    await new Promise((r) => setTimeout(r, 300));
    // Mock: pretend the input video now has synced audio.
    return {
      assets: [{ url: req.videoUrl, mimeType: "video/mp4" }],
      raw: { mock: true },
    };
  },
};
