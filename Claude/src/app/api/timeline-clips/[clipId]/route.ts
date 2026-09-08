import { NextResponse } from "next/server";
import { z } from "zod";
import { removeClip, updateClip } from "@/lib/timeline/service";

const BodySchema = z.object({
  trimStartMs: z.number().int().min(0).optional(),
  trimEndMs: z.number().int().min(0).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ clipId: string }> }) {
  const { clipId } = await params;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const clip = await updateClip(clipId, parsed.data);
  return NextResponse.json({ clip });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ clipId: string }> }) {
  const { clipId } = await params;
  await removeClip(clipId);
  return NextResponse.json({ ok: true });
}
