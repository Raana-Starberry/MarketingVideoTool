import { NextResponse } from "next/server";
import { listProviders } from "@/lib/providers/registry";
import type { ProviderCategory } from "@/lib/providers/types";

const CATEGORIES: ProviderCategory[] = ["image", "video", "voice", "music", "lip-sync", "assets"];

export async function GET() {
  const byCategory = Object.fromEntries(
    CATEGORIES.map((category) => [
      category,
      listProviders(category).map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        connected: p.isConfigured(),
      })),
    ])
  );
  return NextResponse.json({ providers: byCategory });
}
