"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProjectCard({ project }: { project: { id: string; name: string; prompt: string } }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function deleteProject(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="relative group">
      <Link
        href={`/projects/${project.id}`}
        className="block border border-neutral-800 rounded-lg p-4 hover:border-neutral-600 transition-colors"
      >
        <div className="font-medium pr-16">{project.name}</div>
        <div className="text-sm text-neutral-400 line-clamp-2 mt-1">{project.prompt}</div>
      </Link>
      <button
        onClick={deleteProject}
        onBlur={() => setConfirming(false)}
        disabled={deleting}
        className={`absolute top-3 right-3 text-xs px-2 py-1 rounded border disabled:opacity-50 ${
          confirming
            ? "border-red-600 bg-red-600 text-white"
            : "border-neutral-700 text-neutral-500 opacity-0 group-hover:opacity-100 hover:border-red-700 hover:text-red-400"
        }`}
      >
        {deleting ? "Deleting…" : confirming ? "Confirm delete?" : "Delete"}
      </button>
    </div>
  );
}
