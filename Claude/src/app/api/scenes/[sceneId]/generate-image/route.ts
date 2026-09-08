import { NextResponse } from "next/server";
import { z } from "zod";
import { generateSceneImage } from "@/lib/orchestrator/image";

const RequestSchema = z.object({
  variationCount: z.number().int().min(1).max(4).optional(),
  providerId: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ sceneId: string }> }) {
  const { sceneId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await generateSceneImage(sceneId, parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Image generation failed" },
      { status: 502 }
    );
  }
}
