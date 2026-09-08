"use client";

import { useState } from "react";

type ProjectDetail = {
  prompt: string;
  visualBible: {
    characters: { id: string; name: string }[];
    environments: { id: string; name: string }[];
    props: { id: string; name: string }[];
    clothingItems: { id: string; name: string }[];
  } | null;
  story: { rawInput: string; refinedText: string | null } | null;
  scenes: { id: string; index: number }[];
};

const TABS = ["Brief", "Visual Bible", "Story", "Scenes", "Timeline", "Captions", "Music"] as const;

export function ProjectTabs({ project }: { project: ProjectDetail }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Brief");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-neutral-800 text-sm">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 -mb-px border-b-2 ${
              tab === t ? "border-neutral-100 text-neutral-100" : "border-transparent text-neutral-500"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Brief" && <div className="text-sm text-neutral-300 whitespace-pre-wrap">{project.prompt}</div>}

      {tab === "Visual Bible" && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <BibleSection title="Characters" items={project.visualBible?.characters ?? []} />
          <BibleSection title="Environments" items={project.visualBible?.environments ?? []} />
          <BibleSection title="Props" items={project.visualBible?.props ?? []} />
          <BibleSection title="Clothing" items={project.visualBible?.clothingItems ?? []} />
        </div>
      )}

      {tab === "Story" && (
        <div className="text-sm text-neutral-300 whitespace-pre-wrap">
          {project.story?.refinedText ?? project.story?.rawInput ?? "No story yet."}
        </div>
      )}

      {tab === "Scenes" && (
        <div className="text-sm text-neutral-500">
          {project.scenes.length === 0
            ? "No scenes yet — finalize the story to generate a scene breakdown."
            : `${project.scenes.length} scene(s).`}
        </div>
      )}

      {(tab === "Timeline" || tab === "Captions" || tab === "Music") && (
        <div className="text-sm text-neutral-500">Coming in a later build phase — see ARCHITECTURE.md.</div>
      )}
    </div>
  );
}

function BibleSection({ title, items }: { title: string; items: { id: string; name: string }[] }) {
  return (
    <div className="border border-neutral-800 rounded-lg p-3">
      <h3 className="text-neutral-300 font-medium mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-neutral-600 text-xs">None yet</p>
      ) : (
        <ul className="text-neutral-400 text-xs flex flex-col gap-1">
          {items.map((i) => (
            <li key={i.id}>{i.name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
