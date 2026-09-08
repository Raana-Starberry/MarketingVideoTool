import type { AnyProvider, ProviderCategory } from "./types";
import { mockImageProvider } from "./image/mock";
import { geminiImageProvider } from "./image/gemini";
import { mockVideoProvider } from "./video/mock";
import { mockVoiceProvider } from "./voice/mock";
import { mockMusicProvider } from "./music/mock";
import { mockLipSyncProvider } from "./lipsync/mock";
import { mockAssetProvider } from "./assets/mock";

/**
 * Central provider registry. UI and orchestrator code should never import a
 * concrete provider directly — always go through this registry so adding or
 * swapping a provider never touches call sites.
 *
 * Real adapters (Gemini/Nano Banana, Kling, Veo, Higgsfield, ElevenLabs,
 * Envato, ...) are added here one at a time as each build phase is reached
 * (see ARCHITECTURE.md §9). Until then, every category resolves to its mock.
 */
const providers: AnyProvider[] = [
  geminiImageProvider,
  mockImageProvider,
  mockVideoProvider,
  mockVoiceProvider,
  mockMusicProvider,
  mockLipSyncProvider,
  mockAssetProvider,
];

export function listProviders(category: ProviderCategory): AnyProvider[] {
  return providers.filter((p) => p.category === category);
}

export function getProvider(id: string): AnyProvider | undefined {
  return providers.find((p) => p.id === id);
}

export function getDefaultProvider(category: ProviderCategory): AnyProvider {
  const candidates = listProviders(category);
  const configured = candidates.find((p) => p.isConfigured());
  const fallback = configured ?? candidates[0];
  if (!fallback) {
    throw new Error(`No provider registered for category "${category}"`);
  }
  return fallback;
}

export function registerProvider(provider: AnyProvider) {
  providers.push(provider);
}
