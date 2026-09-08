import type { MusicCapabilities, MusicGenerationRequest, MusicProvider, GenerationResult } from "../types";

/**
 * Real music provider backed by ElevenLabs Music (`POST /v1/music`).
 * Synchronous — the response body is the audio file directly, no polling.
 */

const API_BASE = "https://api.elevenlabs.io";

export const elevenLabsMusicProvider: MusicProvider = {
  id: "elevenlabs-music",
  name: "ElevenLabs (Music)",
  category: "music",

  isConfigured: () => Boolean(process.env.ELEVENLABS_API_KEY),

  getCapabilities(): MusicCapabilities {
    return {
      textToMusic: true,
      durationControl: true,
      genreControl: true,
      maxDurationSeconds: 600,
    };
  },

  async generateMusic(req: MusicGenerationRequest): Promise<GenerationResult> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

    const prompt = [req.prompt, req.genre && `Genre: ${req.genre}.`, req.mood && `Mood: ${req.mood}.`]
      .filter(Boolean)
      .join(" ");

    const res = await fetch(`${API_BASE}/v1/music`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        music_length_ms: Math.min(Math.max(req.durationSeconds * 1000, 3000), 600000),
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail?.message || body?.detail || `ElevenLabs Music generation failed (${res.status})`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const base64 = buffer.toString("base64");

    return {
      assets: [
        {
          url: `data:audio/mpeg;base64,${base64}`,
          durationMs: req.durationSeconds * 1000,
          mimeType: "audio/mpeg",
        },
      ],
    };
  },
};
