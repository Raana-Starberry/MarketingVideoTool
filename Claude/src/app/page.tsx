import { prisma } from "@/lib/db/client";
import { NewProjectForm } from "@/components/NewProjectForm";
import { ProjectCard } from "@/components/ProjectCard";

export const dynamic = "force-dynamic";

export default async function ProjectsDashboard() {
  const projects = await prisma.project.findMany({ orderBy: { updatedAt: "desc" } });

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-neutral-400 mt-1 text-sm">
          Each creative concept lives in its own project — story, visual bible, scenes, and timeline
          stay isolated from every other project.
        </p>
      </div>

      <NewProjectForm />

      <div className="flex flex-col gap-2">
        {projects.length === 0 ? (
          <p className="text-neutral-500 text-sm">No projects yet — create one above.</p>
        ) : (
          projects.map((p) => <ProjectCard key={p.id} project={p} />)
        )}
      </div>
    </div>
  );
}
