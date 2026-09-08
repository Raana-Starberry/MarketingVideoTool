import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { NewProjectForm } from "@/components/NewProjectForm";

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
          projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="border border-neutral-800 rounded-lg p-4 hover:border-neutral-600 transition-colors"
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-neutral-400 line-clamp-2 mt-1">{p.prompt}</div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
