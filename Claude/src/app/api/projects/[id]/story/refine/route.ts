import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { refineStory } from "@/lib/scene/planner";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: { story: true, visualBible: { include: { styleProfile: true } } },
  });
  if (!project?.story) {
    return NextResponse.json({ error: "Project or story not found" }, { status: 404 });
  }

  try {
    const visualStyle = project.visualBible?.styleProfile?.renderStyle ?? "cinematic-realistic";
    const refinedText = await refineStory(project.story.rawInput, visualStyle);
    const story = await prisma.story.update({ where: { projectId: id }, data: { refinedText } });
    return NextResponse.json({ story });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to refine story" },
      { status: 502 }
    );
  }
}
