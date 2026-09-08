import type { ImageCapabilities, ImageGenerationRequest, ImageProvider, GenerationResult } from "../types";

const PLACEHOLDER_IMAGE =
  "https://placehold.co/1024x1024/1a1a1a/ffffff/png?text=Mock+Image";

/**
 * Instant, no-network image provider. Lets every screen in the app be built
 * and tested end-to-end before a real credential exists.
 */
export const mockImageProvider: ImageProvider = {
  id: "mock-image",
  name: "Mock Image Provider",
  category: "image",

  isConfigured: () => true,

  getCapabilities(): ImageCapabilities {
    return {
      textToImage: true,
      imageToImage: true,
      referenceImages: true,
      maxReferenceImages: 4,
      supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5"],
      maxResolution: "1024x1024",
      maxPromptLength: 4000,
      variationsPerRequest: [1, 2, 4],
    };
  },

  async generateImage(req: ImageGenerationRequest): Promise<GenerationResult> {
    const count = req.variationCount ?? 1;
    await new Promise((r) => setTimeout(r, 400));
    return {
      assets: Array.from({ length: count }, () => ({
        url: PLACEHOLDER_IMAGE,
        width: 1024,
        height: 1024,
        mimeType: "image/png",
      })),
      raw: { mock: true, prompt: req.prompt },
    };
  },
};
