import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function DELETE(_req: Request, { params }: { params: Promise<{ referenceId: string }> }) {
  const { referenceId } = await params;
  await prisma.reference.delete({ where: { id: referenceId } });
  return NextResponse.json({ ok: true });
}
