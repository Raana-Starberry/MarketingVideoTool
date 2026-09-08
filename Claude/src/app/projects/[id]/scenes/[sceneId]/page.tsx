import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import type { SceneJson } from "@/lib/scene/schema";
import { SceneGenerationPanel } from "@/components/SceneGenerationPanel";

export const dynamic = "force-dynamic";

export default async function SceneDetailPage({
  params,
}: {
  params: Promise<{ id: string; sceneId: string }>;
}) {
  const { id: projectId, sceneId } = await params;

  const scene = await prisma.scene.findUnique({ where: { id: sceneId } });
  if (!scene || scene.projectId !== projectId) notFound();

  const generations = await prisma.generation.findMany({
    where: { sceneId, type: "IMAGE" },
    orderBy: { createdAt: "desc" },
    include: { variations: { include: { asset: true }, orderBy: { createdAt: "asc" } } },
  });

  const generationsForClient = generations.map((g) => ({
    id: g.id,
    status: g.status,
    createdAt: g.createdAt.toISOString(),
    variations: g.variations.map((v) => ({
      id: v.id,
      status: v.status,
      url: v.asset.url ?? `/api/storage/${encodeURIComponent(v.asset.storageKey)}`,
    })),
  }));

  const sceneJson = scene.sceneJson as unknown as SceneJson;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div>
        <Link href={`/projects/${projectId}`} className="text-xs text-neutral-500 hover:text-neutral-300">
          ← Back to project
        </Link>
        <h1 className="text-2xl font-semibold mt-2">
          Scene {sceneJson.index + 1} — {sceneJson.storyBeat}
        </h1>
        <p className="text-neutral-400 text-sm mt-1">{sceneJson.purpose}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <Field label="Environment" value={`${sceneJson.environment.description} · ${sceneJson.environment.lighting}`} />
        <Field label="Camera" value={[sceneJson.camera.angle, sceneJson.camera.movement, sceneJson.camera.framing].filter(Boolean).join(" · ") || "—"} />
        <Field label="Duration" value={`${sceneJson.duration}s`} />
        <Field label="Style" value={sceneJson.style.visualStyle} />
      </div>

      <div className="border border-neutral-800 rounded-lg p-4 flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-300">Image prompt</h2>
        <p className="text-sm text-neutral-400 whitespace-pre-wrap">{sceneJson.generation.imagePrompt}</p>
        {sceneJson.generation.negativePrompt && (
          <p className="text-xs text-neutral-600">Negative: {sceneJson.generation.negativePrompt}</p>
        )}
      </div>

      <SceneGenerationPanel sceneId={sceneId} initialGenerations={generationsForClient} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-neutral-800 rounded-lg p-3">
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      <div className="text-neutral-300">{value}</div>
    </div>
  );
}
