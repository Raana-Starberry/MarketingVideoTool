import type { AssetProvider, AssetSearchResult, GenerationResult } from "../types";

export const mockAssetProvider: AssetProvider = {
  id: "mock-assets",
  name: "Mock Stock Asset Provider",
  category: "assets",

  isConfigured: () => true,

  async search(query: string): Promise<AssetSearchResult[]> {
    return [
      {
        externalId: "mock-1",
        previewUrl: "https://placehold.co/400x300/1a1a1a/ffffff/png?text=" + encodeURIComponent(query),
        title: `Mock result for "${query}"`,
        license: "mock-license",
      },
    ];
  },

  async fetch(externalId: string): Promise<GenerationResult> {
    return {
      assets: [
        {
          url: "https://placehold.co/1024x1024/1a1a1a/ffffff/png?text=" + externalId,
          mimeType: "image/png",
        },
      ],
      raw: { mock: true, externalId },
    };
  },
};
