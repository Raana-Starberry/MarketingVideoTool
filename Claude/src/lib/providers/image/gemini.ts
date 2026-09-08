import type { ImageCapabilities, ImageGenerationRequest, ImageProvider, GenerationResult } from "../types";

/**
 * Real image provider backed by Gemini's "Nano Banana" image-generation model
 * via the Generative Language API. Auth is a plain API key sent as the
 * `x-goog-api-key` header — see https://ai.google.dev.
 *
 * Verified against the live API on 2026-09-08: authentication succeeds, but
 * image generation itself returns 429 RESOURCE_EXHAUSTED (free-tier quota of
 * 0 requests/day for image models) until billing is enabled on the Google
 * Cloud project behind this key.
 */

const MODEL = "gemini-2.5-flash-image";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

async function urlToInlinePart(url: string): Promise<GeminiPart> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch reference image ${url}: ${res.status}`);
  const mimeType = res.headers.get("content-type") || "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { inlineData: { mimeType, data: buffer.toString("base64") } };
}

async function generateOne(apiKey: string, req: ImageGenerationRequest): Promise<GenerationResult["assets"][number]> {
  const parts: GeminiPart[] = [];

  if (req.references?.length) {
    for (const ref of req.references) {
      parts.push(await urlToInlinePart(ref.url));
    }
  }

  let promptText = req.prompt;
  if (req.negativePrompt) {
    promptText += `\n\nAvoid the following: ${req.negativePrompt}`;
  }
  if (req.aspectRatio) {
    promptText += `\n\nTarget aspect ratio: ${req.aspectRatio}.`;
  }
  parts.push({ text: promptText });

  const res = await fetch(`${API_BASE}/${MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contents: [{ parts }] }),
  });

  const body = await res.json();

  if (!res.ok) {
    const message = body?.error?.message || `Gemini image generation failed (${res.status})`;
    throw new Error(message);
  }

  const imagePart = body?.candidates?.[0]?.content?.parts?.find(
    (p: GeminiPart) => p.inlineData?.data
  );
  if (!imagePart?.inlineData) {
    throw new Error("Gemini response did not contain an image part");
  }

  const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
  return { url: dataUrl, mimeType: imagePart.inlineData.mimeType };
}

export const geminiImageProvider: ImageProvider = {
  id: "gemini-nano-banana",
  name: "Gemini (Nano Banana)",
  category: "image",

  isConfigured: () => Boolean(process.env.GEMINI_API_KEY),

  getCapabilities(): ImageCapabilities {
    return {
      textToImage: true,
      imageToImage: true,
      referenceImages: true,
      maxReferenceImages: 3,
      supportedAspectRatios: ["1:1", "16:9", "9:16", "4:5", "4:3"],
      maxPromptLength: 8000,
      variationsPerRequest: [1, 2, 4],
    };
  },

  async generateImage(req: ImageGenerationRequest): Promise<GenerationResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

    const count = req.variationCount ?? 1;
    const assets = await Promise.all(
      Array.from({ length: count }, () => generateOne(apiKey, req))
    );

    return { assets };
  },
};
