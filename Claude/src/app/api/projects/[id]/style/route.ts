import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { STYLE_OPTIONS } from "@/lib/scene/styles";

const BodySchema = z.object({
  renderStyle: z.enum(STYLE_OPTIONS.map((s) => s.value) as [string, ...string[]]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const visualBible = await prisma.visualBible.findUnique({ where: { projectId } });
  if (!visualBible) {
    return NextResponse.json({ error: "Project has no Visual Bible" }, { status: 404 });
  }

  const styleProfile = await prisma.styleProfile.upsert({
    where: { visualBibleId: visualBible.id },
    update: { renderStyle: parsed.data.renderStyle },
    create: { visualBibleId: visualBible.id, renderStyle: parsed.data.renderStyle, colorPalette: [] },
  });

  return NextResponse.json({ styleProfile });
}
