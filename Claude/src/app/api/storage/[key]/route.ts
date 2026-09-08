import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { readLocalAsset } from "@/lib/storage/local";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const decodedKey = decodeURIComponent(key);

  const asset = await prisma.asset.findFirst({ where: { storageKey: decodedKey } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const buffer = await readLocalAsset(decodedKey);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": asset.mimeType || "application/octet-stream" },
    });
  } catch {
    return NextResponse.json({ error: "Asset file missing" }, { status: 404 });
  }
}
