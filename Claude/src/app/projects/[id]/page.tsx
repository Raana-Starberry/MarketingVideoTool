import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { ProjectTabs } from "@/components/ProjectTabs";

export const dynamic = "force-dynamic";

export default async function ProjectWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      visualBible: {
        include: { styleProfile: true, characters: true, environments: true, props: true, clothingItems: true },
      },
      story: true,
      scenes: { orderBy: { index: "asc" } },
      timeline: {
        include: {
          clips: {
            orderBy: { order: "asc" },
            include: { variation: { include: { asset: true } }, asset: true },
          },
        },
      },
    },
  });

  if (!project) notFound();

  const resolveAssetUrl = (asset: { url: string | null; storageKey: string } | null | undefined) =>
    asset ? asset.url ?? `/api/storage/${encodeURIComponent(asset.storageKey)}` : null;

  const timelineClips = (project.timeline?.clips ?? []).map((c) => ({
    id: c.id,
    order: c.order,
    trimStartMs: c.trimStartMs,
    trimEndMs: c.trimEndMs,
    url: resolveAssetUrl(c.asset ?? c.variation?.asset),
  }));

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Style: {project.visualBible?.styleProfile?.renderStyle ?? "unset"}
        </p>
      </div>

      <ProjectTabs project={{ ...project, timelineClips }} />
    </div>
  );
}
