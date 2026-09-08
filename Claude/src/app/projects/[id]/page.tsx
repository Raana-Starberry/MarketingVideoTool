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
      references: { include: { asset: true }, orderBy: { createdAt: "desc" } },
      story: true,
      scenes: { orderBy: { index: "asc" } },
    },
  });

  if (!project) notFound();

  const references = project.references.map((r) => ({
    id: r.id,
    kind: r.kind,
    label: r.label,
    url: r.asset.url ?? `/api/storage/${encodeURIComponent(r.asset.storageKey)}`,
    characterId: r.characterId,
    environmentId: r.environmentId,
    propId: r.propId,
    clothingItemId: r.clothingItemId,
  }));

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Style: {project.visualBible?.styleProfile?.renderStyle ?? "unset"}
        </p>
      </div>

      <ProjectTabs project={{ ...project, references }} />
    </div>
  );
}
