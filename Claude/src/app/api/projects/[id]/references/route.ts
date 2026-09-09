import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { localStorageProvider } from "@/lib/storage/local";
import type { AssetType, ReferenceKind } from "@prisma/client";

const REFERENCE_KINDS = [
  "CHARACTER_SHEET",
  "CHARACTER_IMAGE",
  "CLOTHING",
  "ENVIRONMENT",
  "ART_DIRECTION",
  "GAME_SCREENSHOT",
  "PROP",
  "CAMERA_COMPOSITION",
  "PREVIOUS_FRAME",
  "OTHER",
] as const;

const ENTITY_TYPES = ["character", "environment", "prop", "clothingItem"] as const;

const FieldsSchema = z.object({
  kind: z.enum(REFERENCE_KINDS),
  label: z.string().optional(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  entityId: z.string().optional(),
});

function assetTypeFromMime(mimeType: string): AssetType {
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  if (mimeType.startsWith("image/")) return "IMAGE";
  return "OTHER";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const parsed = FieldsSchema.safeParse({
    kind: form.get("kind"),
    label: form.get("label") || undefined,
    entityType: form.get("entityType") || undefined,
    entityId: form.get("entityId") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const visualBible = await prisma.visualBible.findUnique({ where: { projectId } });
  if (!visualBible) {
    return NextResponse.json({ error: "Project has no Visual Bible" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const assetId = randomUUID();
  await localStorageProvider.put(assetId, buffer, file.type || "application/octet-stream");

  const asset = await prisma.asset.create({
    data: {
      id: assetId,
      type: assetTypeFromMime(file.type || ""),
      storageKey: assetId,
      mimeType: file.type || null,
    },
  });

  const { entityType, entityId } = parsed.data;
  const reference = await prisma.reference.create({
    data: {
      projectId,
      assetId: asset.id,
      kind: parsed.data.kind as ReferenceKind,
      label: parsed.data.label,
      characterId: entityType === "character" ? entityId : undefined,
      environmentId: entityType === "environment" ? entityId : undefined,
      propId: entityType === "prop" ? entityId : undefined,
      clothingItemId: entityType === "clothingItem" ? entityId : undefined,
    },
    include: { asset: true },
  });

  return NextResponse.json({
    reference: { ...reference, resolvedUrl: await localStorageProvider.resolveUrl(asset.storageKey) },
  });
}
