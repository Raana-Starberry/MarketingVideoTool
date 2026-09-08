/**
 * Turns ElevenLabs' character-level TTS alignment (from the with-timestamps
 * endpoint — see src/lib/providers/voice/elevenlabs.ts) into caption
 * segments. Used instead of a separate transcription/captioning provider:
 * since we generate the dialogue audio ourselves, ElevenLabs already hands
 * back exactly where every character lands in time.
 *
 * Matches the CaptionSegment shape (ARCHITECTURE.md §11): text + startMs +
 * endMs, ready to persist under a project's CaptionTrack.
 */

export interface CharacterAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface CaptionSegmentDraft {
  text: string;
  startMs: number;
  endMs: number;
}

const WHITESPACE = /\s/;
const SENTENCE_END = /[.!?]/;

export function alignmentToWordCaptions(alignment: CharacterAlignment): CaptionSegmentDraft[] {
  const segments: CaptionSegmentDraft[] = [];
  let buffer = "";
  let startSec: number | null = null;
  let endSec = 0;

  const flush = () => {
    if (buffer.length > 0 && startSec !== null) {
      segments.push({ text: buffer, startMs: Math.round(startSec * 1000), endMs: Math.round(endSec * 1000) });
    }
    buffer = "";
    startSec = null;
  };

  alignment.characters.forEach((char, i) => {
    if (WHITESPACE.test(char)) {
      flush();
      return;
    }
    if (startSec === null) startSec = alignment.character_start_times_seconds[i];
    endSec = alignment.character_end_times_seconds[i];
    buffer += char;
  });
  flush();

  return segments;
}

export function alignmentToSentenceCaptions(alignment: CharacterAlignment): CaptionSegmentDraft[] {
  const segments: CaptionSegmentDraft[] = [];
  let buffer = "";
  let startSec: number | null = null;
  let endSec = 0;

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed.length > 0 && startSec !== null) {
      segments.push({ text: trimmed, startMs: Math.round(startSec * 1000), endMs: Math.round(endSec * 1000) });
    }
    buffer = "";
    startSec = null;
  };

  alignment.characters.forEach((char, i) => {
    if (startSec === null && !WHITESPACE.test(char)) {
      startSec = alignment.character_start_times_seconds[i];
    }
    endSec = alignment.character_end_times_seconds[i];
    buffer += char;
    if (SENTENCE_END.test(char)) flush();
  });
  flush();

  return segments;
}

export function alignmentToCaptions(
  alignment: CharacterAlignment,
  granularity: "word" | "sentence" = "word"
): CaptionSegmentDraft[] {
  return granularity === "word" ? alignmentToWordCaptions(alignment) : alignmentToSentenceCaptions(alignment);
}
