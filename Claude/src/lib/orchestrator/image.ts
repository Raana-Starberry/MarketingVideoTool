import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";
import { getDefaultProvider, getProvider } from "@/lib/providers/registry";
import type { ImageProvider } from "@/lib/providers/types";
import { localStorageProvider } from "@/lib/storage/local";
import type { SceneJson } from "@/lib/scene/schema";

/**
 * Generation Orchestrator (ARCHITECTURE.md §7) for the image step: loads the
 * scene's prompt, calls the selected ImageProvider, persists the resulting
 * assets, and records the Generation/GenerationVariation/GenerationJob rows.
 *
 * Runs synchronously for MVP — see ARCHITECTURE.md's async job model for the
 * planned upgrade to a polling job queue once this needs to scale.
 */

async function persistAsset(url: string, mimeType: string): Promise<{ id: string; url: string }> {
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) throw new Error("Malformed data URL from image provider");
    const [, dataMimeType, base64] = match;
    const buffer = Buffer.from(base64, "base64");
    const id = randomUUID();
    await localStorageProvider.put(id, buffer, dataMimeType);
    const asset = await prisma.asset.create({
      data: { id, type: "IMAGE", storageKey: id, mimeType: dataMimeType },
    });
    return { id: asset.id, url: await localStorageProvider.resolveUrl(id) };
  }

  // Provider already hosts the asset externally (e.g. the mock provider) — no need to re-store it.
  const asset = await prisma.asset.create({
    data: { id: randomUUID(), type: "IMAGE", storageKey: url, url, mimeType },
  });
  return { id: asset.id, url };
}

export async function generateSceneImage(sceneRowId: string, opts: { variationCount?: number; providerId?: string } = {}) {
  const scene = await prisma.scene.findUnique({ where: { id: sceneRowId } });
  if (!scene) throw new Error("Scene not found");

  const sceneJson = scene.sceneJson as unknown as SceneJson;
  const provider = (opts.providerId ? getProvider(opts.providerId) : getDefaultProvider("image")) as ImageProvider;
  if (!provider || provider.category !== "image") throw new Error("No image provider available");

  const variationCount = opts.variationCount ?? 1;

  const generation = await prisma.generation.create({
    data: {
      projectId: scene.projectId,
      sceneId: scene.id,
      type: "IMAGE",
      providerId: provider.id,
      model: provider.id,
      status: "RUNNING",
      request: {
        prompt: sceneJson.generation.imagePrompt,
        negativePrompt: sceneJson.generation.negativePrompt,
        variationCount,
      },
    },
  });

  const job = await prisma.generationJob.create({
    data: { projectId: scene.projectId, generationId: generation.id, status: "GENERATING", startedAt: new Date() },
  });

  try {
    const result = await provider.generateImage({
      prompt: sceneJson.generation.imagePrompt,
      negativePrompt: sceneJson.generation.negativePrompt,
      aspectRatio: "16:9",
      variationCount,
    });

    const variations = [];
    for (const asset of result.assets) {
      const stored = await persistAsset(asset.url, asset.mimeType);
      const variation = await prisma.generationVariation.create({
        data: { generationId: generation.id, assetId: stored.id, status: "PENDING" },
        include: { asset: true },
      });
      variations.push({ ...variation, resolvedUrl: stored.url });
    }

    const completedGeneration = await prisma.generation.update({
      where: { id: generation.id },
      data: { status: "COMPLETED" },
    });
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", progress: 100, completedAt: new Date() },
    });

    return { generation: completedGeneration, variations };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Image generation failed";
    await prisma.generation.update({ where: { id: generation.id }, data: { status: "FAILED" } });
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "FAILED", error: message, completedAt: new Date() },
    });
    throw e;
  }
}
