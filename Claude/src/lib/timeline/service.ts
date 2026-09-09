import { prisma } from "@/lib/db/client";

/**
 * Timeline service (ARCHITECTURE.md §6/§12). MVP scope: ordered clips with
 * trim points and up/down reordering — drag-and-drop and transitions are a
 * later increment. A clip wraps either a GenerationVariation (the usual
 * path — a selected/favorited generation) or a bare Asset (e.g. a captured
 * reference frame used directly).
 */

export async function getOrCreateTimeline(projectId: string) {
  const existing = await prisma.timeline.findUnique({ where: { projectId } });
  if (existing) return existing;
  return prisma.timeline.create({ data: { projectId } });
}

export async function addClip(
  projectId: string,
  input: { variationId?: string; assetId?: string; trimStartMs?: number; trimEndMs?: number }
) {
  const timeline = await getOrCreateTimeline(projectId);

  const last = await prisma.timelineClip.findFirst({
    where: { timelineId: timeline.id },
    orderBy: { order: "desc" },
  });

  return prisma.timelineClip.create({
    data: {
      timelineId: timeline.id,
      order: (last?.order ?? -1) + 1,
      variationId: input.variationId,
      assetId: input.assetId,
      trimStartMs: input.trimStartMs ?? 0,
      trimEndMs: input.trimEndMs,
    },
  });
}

export async function updateClip(clipId: string, input: { trimStartMs?: number; trimEndMs?: number | null }) {
  return prisma.timelineClip.update({
    where: { id: clipId },
    data: {
      ...(input.trimStartMs !== undefined ? { trimStartMs: input.trimStartMs } : {}),
      ...(input.trimEndMs !== undefined ? { trimEndMs: input.trimEndMs } : {}),
    },
  });
}

export async function removeClip(clipId: string) {
  return prisma.timelineClip.delete({ where: { id: clipId } });
}

export async function moveClip(clipId: string, direction: "up" | "down") {
  const clip = await prisma.timelineClip.findUnique({ where: { id: clipId } });
  if (!clip) throw new Error("Clip not found");

  const neighbor = await prisma.timelineClip.findFirst({
    where: {
      timelineId: clip.timelineId,
      order: direction === "up" ? { lt: clip.order } : { gt: clip.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return clip; // already at the edge

  await prisma.$transaction([
    prisma.timelineClip.update({ where: { id: clip.id }, data: { order: neighbor.order } }),
    prisma.timelineClip.update({ where: { id: neighbor.id }, data: { order: clip.order } }),
  ]);

  return clip;
}
