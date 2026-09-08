import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";

const UpdateSchema = z.object({
  status: z.enum(["PENDING", "SELECTED", "FAVORITE", "REJECTED"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ variationId: string }> }) {
  const { variationId } = await params;
  const body = await request.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const variation = await prisma.generationVariation.update({
    where: { id: variationId },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ variation });
}
