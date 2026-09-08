import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  prompt: z.string().min(1),
});

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      prompt: parsed.data.prompt,
      visualBible: {
        create: {
          styleProfile: {
            create: { renderStyle: "cinematic-realistic", colorPalette: [] },
          },
        },
      },
      story: { create: { rawInput: parsed.data.prompt } },
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
