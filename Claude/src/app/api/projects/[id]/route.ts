import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      visualBible: { include: { styleProfile: true, characters: true, environments: true, props: true, clothingItems: true } },
      story: true,
      scenes: { orderBy: { index: "asc" } },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ project });
}
