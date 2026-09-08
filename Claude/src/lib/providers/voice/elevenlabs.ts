import type { VoiceCapabilities, VoiceGenerationRequest, VoiceProvider, GenerationResult } from "../types";

/**
 * Real voice provider backed by ElevenLabs. Uses the "with-timestamps"
 * text-to-speech endpoint rather than the plain one, so every generation
 * comes back with character-level alignment data for free — that alignment
 * is what src/lib/captions/align.ts turns into caption segments, so VO and
 * captions share one generation call instead of needing a separate
 * transcription pass.
 *
 * Auth: `xi-api-key` header. See https://elevenlabs.io/docs/api-reference.
 */

const API_BASE = "https://api.elevenlabs.io";
const DEFAULT_MODEL = "eleven_multilingual_v2";

interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

interface ElevenLabsTtsResponse {
  audio_base64: string;
  alignment: ElevenLabsAlignment | null;
  normalized_alignment: ElevenLabsAlignment | null;
}

let cachedDefaultVoiceId: string | null = null;

async function getDefaultVoiceId(apiKey: string): Promise<string> {
  if (cachedDefaultVoiceId) return cachedDefaultVoiceId;

  const res = await fetch(`${API_BASE}/v2/voices?category=premade&page_size=1`, {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) throw new Error(`Failed to look up a default ElevenLabs voice (${res.status})`);
  const body = await res.json();
  const voiceId = body?.voices?.[0]?.voice_id;
  if (!voiceId) throw new Error("No ElevenLabs voices available on this account");

  cachedDefaultVoiceId = voiceId;
  return voiceId;
}

export const elevenLabsVoiceProvider: VoiceProvider = {
  id: "elevenlabs-voice",
  name: "ElevenLabs (Voice)",
  category: "voice",

  isConfigured: () => Boolean(process.env.ELEVENLABS_API_KEY),

  getCapabilities(): VoiceCapabilities {
    return {
      textToSpeech: true,
      voiceCloning: true,
      voiceLibrary: true,
      soundEffects: false,
      maxTextLength: 5000,
    };
  },

  async generateSpeech(req: VoiceGenerationRequest): Promise<GenerationResult> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

    const voiceId = req.voiceId || (await getDefaultVoiceId(apiKey));

    const res = await fetch(`${API_BASE}/v1/text-to-speech/${voiceId}/with-timestamps`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: req.text,
        model_id: DEFAULT_MODEL,
        language_code: req.language,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail?.message || body?.detail || `ElevenLabs TTS failed (${res.status})`);
    }

    const body = (await res.json()) as ElevenLabsTtsResponse;

    return {
      assets: [
        {
          url: `data:audio/mpeg;base64,${body.audio_base64}`,
          mimeType: "audio/mpeg",
        },
      ],
      raw: { alignment: body.alignment, voiceId },
    };
  },
};
