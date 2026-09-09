import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";

const UpdateStorySchema = z.object({ rawInput: z.string().min(1) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = UpdateStorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const story = await prisma.story.update({
    where: { projectId: id },
    data: { rawInput: parsed.data.rawInput, refinedText: null, beatSheet: Prisma.JsonNull, finalizedAt: null },
  });

  return NextResponse.json({ story });
}
