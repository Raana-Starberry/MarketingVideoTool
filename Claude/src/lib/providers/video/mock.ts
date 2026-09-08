import type { VideoCapabilities, VideoGenerationRequest, VideoProvider, GenerationResult } from "../types";

const PLACEHOLDER_VIDEO =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

/** Instant, no-network video provider for building/testing the app before a real key exists. */
export const mockVideoProvider: VideoProvider = {
  id: "mock-video",
  name: "Mock Video Provider",
  category: "video",

  isConfigured: () => true,

  getCapabilities(): VideoCapabilities {
    return {
      textToVideo: true,
      imageToVideo: true,
      firstFrameReference: true,
      lastFrameReference: true,
      characterReference: true,
      nativeAudio: false,
      nativeLipSync: false,
      supportedDurations: [3, 5, 8],
      supportedAspectRatios: ["16:9", "9:16", "1:1"],
      maxResolution: "1280x720",
      cameraControls: true,
      maxPromptLength: 2000,
    };
  },

  async generateVideo(req: VideoGenerationRequest): Promise<GenerationResult> {
    await new Promise((r) => setTimeout(r, 600));
    return {
      assets: [
        {
          url: PLACEHOLDER_VIDEO,
          durationMs: req.durationSeconds * 1000,
          mimeType: "video/mp4",
        },
      ],
      raw: { mock: true, prompt: req.prompt },
    };
  },
};
