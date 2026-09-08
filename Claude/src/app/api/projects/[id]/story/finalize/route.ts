import { NextResponse } from "next/server";
import { z } from "zod";
import { finalizeStoryAndGenerateScenes } from "@/lib/scene/planner";

const FinalizeSchema = z.object({ sceneCount: z.number().int().min(3).max(8).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = FinalizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const scenes = await finalizeStoryAndGenerateScenes(id, { sceneCount: parsed.data.sceneCount });
    return NextResponse.json({ scenes });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate scenes" },
      { status: 502 }
    );
  }
}
