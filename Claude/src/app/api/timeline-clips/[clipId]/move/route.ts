import { NextResponse } from "next/server";
import { z } from "zod";
import { moveClip } from "@/lib/timeline/service";

const BodySchema = z.object({ direction: z.enum(["up", "down"]) });

export async function POST(request: Request, { params }: { params: Promise<{ clipId: string }> }) {
  const { clipId } = await params;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const clip = await moveClip(clipId, parsed.data.direction);
  return NextResponse.json({ clip });
}
