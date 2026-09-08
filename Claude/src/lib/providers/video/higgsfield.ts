import type { VideoCapabilities, VideoGenerationRequest, VideoProvider, GenerationResult } from "../types";

/**
 * Real video provider backed by Higgsfield's API, which itself proxies many
 * underlying video models (Kling, Veo, Sora-2, Seedance, Hailuo, ...) behind
 * one credential. This adapter targets Kling v2.5 Turbo Pro as the default
 * model — see https://docs.higgsfield.ai/docs/openapi.json for the full
 * model catalog if another one should be added later.
 *
 * Verified against the live API on 2026-09-08: authentication with the
 * Key ID + Secret pair succeeds (confirmed via a 403 "not_enough_credits"
 * response, not 401 Invalid credentials) — actual generation is blocked
 * until the account has credits.
 */

const API_BASE = "https://api.higgsfield.ai";
const TEXT_TO_VIDEO_PATH = "/kling-video/v2.5-turbo/pro/text-to-video";
const IMAGE_TO_VIDEO_PATH = "/kling-video/v2.5-turbo/pro/image-to-video";

interface HiggsfieldRequestStatus {
  status: "queued" | "in_progress" | "nsfw" | "failed" | "completed" | "canceled";
  request_id: string;
  status_url: string;
  error?: string | null;
  video?: { url: string };
}

function authHeader(): string {
  const id = process.env.HIGGSFIELD_API_KEY_ID;
  const secret = process.env.HIGGSFIELD_API_KEY_SECRET;
  if (!id || !secret) throw new Error("HIGGSFIELD_API_KEY_ID / HIGGSFIELD_API_KEY_SECRET are not set");
  return `Key ${id}:${secret}`;
}

function nearestAllowedDuration(seconds: number): 5 | 10 {
  return seconds > 7 ? 10 : 5;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollUntilDone(statusUrl: string, timeoutMs = 5 * 60 * 1000): Promise<HiggsfieldRequestStatus> {
  const start = Date.now();
  let delay = 2000;

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(statusUrl, { headers: { Authorization: authHeader() } });
    const body = (await res.json()) as HiggsfieldRequestStatus;

    if (["completed", "failed", "nsfw", "canceled"].includes(body.status)) {
      return body;
    }

    await sleep(delay + Math.random() * 500);
    delay = Math.min(delay * 1.5, 10000);
  }

  throw new Error("Higgsfield generation timed out while polling for a result");
}

export const higgsfieldVideoProvider: VideoProvider = {
  id: "higgsfield-kling-2.5-turbo-pro",
  name: "Higgsfield (Kling 2.5 Turbo Pro)",
  category: "video",

  isConfigured: () => Boolean(process.env.HIGGSFIELD_API_KEY_ID && process.env.HIGGSFIELD_API_KEY_SECRET),

  getCapabilities(): VideoCapabilities {
    return {
      textToVideo: true,
      imageToVideo: true,
      firstFrameReference: true,
      lastFrameReference: false,
      characterReference: false,
      nativeAudio: false,
      nativeLipSync: false,
      supportedDurations: [5, 10],
      supportedAspectRatios: ["16:9"],
      cameraControls: false,
    };
  },

  async generateVideo(req: VideoGenerationRequest): Promise<GenerationResult> {
    const isImageToVideo = Boolean(req.firstFrameImageUrl);
    const path = isImageToVideo ? IMAGE_TO_VIDEO_PATH : TEXT_TO_VIDEO_PATH;

    const body: Record<string, unknown> = {
      prompt: req.prompt,
      duration: nearestAllowedDuration(req.durationSeconds),
      negative_prompt: req.negativePrompt ?? "",
    };
    if (isImageToVideo) body.image_url = req.firstFrameImageUrl;

    const submitRes = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const submitBody = (await submitRes.json()) as HiggsfieldRequestStatus & { detail?: string };

    if (!submitRes.ok) {
      throw new Error(submitBody.detail || `Higgsfield request failed (${submitRes.status})`);
    }

    const finalStatus = await pollUntilDone(submitBody.status_url);

    if (finalStatus.status !== "completed" || !finalStatus.video) {
      throw new Error(finalStatus.error || `Higgsfield generation ended with status "${finalStatus.status}"`);
    }

    return {
      assets: [
        {
          url: finalStatus.video.url,
          durationMs: nearestAllowedDuration(req.durationSeconds) * 1000,
          mimeType: "video/mp4",
        },
      ],
      raw: finalStatus,
    };
  },
};
