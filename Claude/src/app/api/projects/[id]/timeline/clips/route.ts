import { NextResponse } from "next/server";
import { z } from "zod";
import { addClip } from "@/lib/timeline/service";

const BodySchema = z
  .object({
    variationId: z.string().optional(),
    assetId: z.string().optional(),
    trimStartMs: z.number().int().min(0).optional(),
    trimEndMs: z.number().int().min(0).optional(),
  })
  .refine((v) => v.variationId || v.assetId, { message: "variationId or assetId is required" });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const clip = await addClip(projectId, parsed.data);
  return NextResponse.json({ clip }, { status: 201 });
}
