// Shared provider types. Every generation capability (image, video, voice,
// music, lip-sync, stock assets) implements one of these interfaces and is
// registered in the provider registry (./registry.ts). See ARCHITECTURE.md §5.

export type ProviderCategory =
  | "image"
  | "video"
  | "voice"
  | "music"
  | "lip-sync"
  | "assets"
  | "llm";

/** A single reference image/clip handed to a provider for consistency. */
export interface ProviderReference {
  url: string;
  kind: "character" | "clothing" | "environment" | "prop" | "style" | "previous-frame" | "other";
  label?: string;
}

export interface GenerationResultAsset {
  url: string;
  width?: number;
  height?: number;
  durationMs?: number;
  mimeType: string;
}

export interface GenerationResult {
  assets: GenerationResultAsset[];
  costActual?: number;
  raw?: unknown; // untouched provider response, for debugging/audit
}

/** Base fields every provider must report so the UI never hard-codes a provider's identity. */
export interface ProviderMeta {
  id: string;
  name: string;
  category: ProviderCategory;
  /** True once the required env vars for this provider are present. */
  isConfigured(): boolean;
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

export interface ImageCapabilities {
  textToImage: boolean;
  imageToImage: boolean;
  referenceImages: boolean;
  maxReferenceImages?: number;
  supportedAspectRatios: string[];
  maxResolution?: string;
  maxPromptLength?: number;
  variationsPerRequest: number[];
}

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  references?: ProviderReference[];
  variationCount?: number;
  seed?: number;
}

export interface ImageProvider extends ProviderMeta {
  category: "image";
  getCapabilities(): ImageCapabilities;
  generateImage(req: ImageGenerationRequest): Promise<GenerationResult>;
}

// ---------------------------------------------------------------------------
// Video
// ---------------------------------------------------------------------------

export interface VideoCapabilities {
  textToVideo: boolean;
  imageToVideo: boolean;
  firstFrameReference: boolean;
  lastFrameReference: boolean;
  characterReference: boolean;
  nativeAudio: boolean;
  nativeLipSync: boolean;
  supportedDurations: number[];
  supportedAspectRatios: string[];
  maxResolution?: string;
  cameraControls?: boolean;
  maxPromptLength?: number;
}

export interface VideoGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  durationSeconds: number;
  aspectRatio: string;
  firstFrameImageUrl?: string;
  lastFrameImageUrl?: string;
  references?: ProviderReference[];
  cameraMovement?: string;
}

export interface VideoProvider extends ProviderMeta {
  category: "video";
  getCapabilities(): VideoCapabilities;
  generateVideo(req: VideoGenerationRequest): Promise<GenerationResult>;
}

// ---------------------------------------------------------------------------
// Voice
// ---------------------------------------------------------------------------

export interface VoiceCapabilities {
  textToSpeech: boolean;
  voiceCloning: boolean;
  voiceLibrary: boolean;
  soundEffects: boolean;
  supportedLanguages?: string[];
  maxTextLength?: number;
}

export interface VoiceGenerationRequest {
  text: string;
  voiceId?: string;
  emotion?: string;
  language?: string;
}

export interface VoiceProvider extends ProviderMeta {
  category: "voice";
  getCapabilities(): VoiceCapabilities;
  generateSpeech(req: VoiceGenerationRequest): Promise<GenerationResult>;
}

// ---------------------------------------------------------------------------
// Music
// ---------------------------------------------------------------------------

export interface MusicCapabilities {
  textToMusic: boolean;
  durationControl: boolean;
  genreControl: boolean;
  maxDurationSeconds?: number;
}

export interface MusicGenerationRequest {
  prompt: string;
  durationSeconds: number;
  genre?: string;
  mood?: string;
}

export interface MusicProvider extends ProviderMeta {
  category: "music";
  getCapabilities(): MusicCapabilities;
  generateMusic(req: MusicGenerationRequest): Promise<GenerationResult>;
}

// ---------------------------------------------------------------------------
// Lip Sync
// ---------------------------------------------------------------------------

export interface LipSyncCapabilities {
  standaloneSync: boolean; // false if this "provider" only wraps a video provider's native lip sync
  maxDurationSeconds?: number;
}

export interface LipSyncGenerationRequest {
  videoUrl: string;
  audioUrl: string;
}

export interface LipSyncProvider extends ProviderMeta {
  category: "lip-sync";
  getCapabilities(): LipSyncCapabilities;
  generate(req: LipSyncGenerationRequest): Promise<GenerationResult>;
}

// ---------------------------------------------------------------------------
// Stock / licensed assets (e.g. Envato)
// ---------------------------------------------------------------------------

export interface AssetSearchResult {
  externalId: string;
  previewUrl: string;
  title: string;
  license?: string;
}

export interface AssetProvider extends ProviderMeta {
  category: "assets";
  search(query: string): Promise<AssetSearchResult[]>;
  fetch(externalId: string): Promise<GenerationResult>;
}

// ---------------------------------------------------------------------------
// LLM (story refinement, entity extraction, scene breakdown)
// ---------------------------------------------------------------------------

export interface LLMCapabilities {
  supportsJsonMode: boolean;
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

export interface LLMGenerationRequest {
  prompt: string;
  jsonMode?: boolean;
  maxOutputTokens?: number;
}

export interface LLMResult {
  text: string;
}

export interface LLMProvider extends ProviderMeta {
  category: "llm";
  getCapabilities(): LLMCapabilities;
  generateText(req: LLMGenerationRequest): Promise<LLMResult>;
}

export type AnyProvider =
  | ImageProvider
  | VideoProvider
  | VoiceProvider
  | MusicProvider
  | LipSyncProvider
  | AssetProvider
  | LLMProvider;
