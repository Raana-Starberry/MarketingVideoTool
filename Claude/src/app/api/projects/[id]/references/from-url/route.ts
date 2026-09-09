import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { localStorageProvider } from "@/lib/storage/local";
import { captureFramesFromUrl } from "@/lib/video/capture-frames";

const ENTITY_TYPES = ["character", "environment", "prop", "clothingItem"] as const;

const BodySchema = z.object({
  url: z.string().url(),
  frameCount: z.number().int().min(1).max(8).optional(),
  label: z.string().optional(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  entityId: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const visualBible = await prisma.visualBible.findUnique({ where: { projectId } });
  if (!visualBible) {
    return NextResponse.json({ error: "Project has no Visual Bible" }, { status: 404 });
  }

  let frames;
  try {
    frames = await captureFramesFromUrl(parsed.data.url, parsed.data.frameCount ?? 5);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to capture frames from that link" },
      { status: 422 }
    );
  }

  const { entityType, entityId, label } = parsed.data;
  const references = [];
  for (const frame of frames) {
    const assetId = randomUUID();
    await localStorageProvider.put(assetId, frame.buffer, "image/jpeg");
    const asset = await prisma.asset.create({
      data: { id: assetId, type: "IMAGE", storageKey: assetId, mimeType: "image/jpeg" },
    });
    const reference = await prisma.reference.create({
      data: {
        projectId,
        assetId: asset.id,
        kind: "GAME_SCREENSHOT",
        label: label || `Captured at ${frame.timestampSeconds.toFixed(1)}s`,
        characterId: entityType === "character" ? entityId : undefined,
        environmentId: entityType === "environment" ? entityId : undefined,
        propId: entityType === "prop" ? entityId : undefined,
        clothingItemId: entityType === "clothingItem" ? entityId : undefined,
      },
      include: { asset: true },
    });
    references.push({
      ...reference,
      resolvedUrl: await localStorageProvider.resolveUrl(asset.storageKey),
    });
  }

  return NextResponse.json({ references });
}
