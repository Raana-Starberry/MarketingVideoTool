"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SceneJson } from "@/lib/scene/schema";
import { BEAT_ORDER, BEAT_LABELS, type BeatSheet } from "@/lib/scene/story-schema";

type ProjectDetail = {
  id: string;
  prompt: string;
  visualBible: {
    characters: { id: string; name: string }[];
    environments: { id: string; name: string }[];
    props: { id: string; name: string }[];
    clothingItems: { id: string; name: string }[];
  } | null;
  story: {
    rawInput: string;
    refinedText: string | null;
    beatSheet: unknown;
    finalizedAt: string | Date | null;
  } | null;
  scenes: { id: string; index: number; sceneJson: unknown }[];
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

      {tab === "Story" && <StoryPanel projectId={project.id} story={project.story} onScenesGenerated={() => setTab("Scenes")} />}

      {tab === "Scenes" && <ScenesPanel projectId={project.id} scenes={project.scenes} />}

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

function StoryPanel({
  projectId,
  story,
  onScenesGenerated,
}: {
  projectId: string;
  story: ProjectDetail["story"];
  onScenesGenerated: () => void;
}) {
  const router = useRouter();
  const [rawInput, setRawInput] = useState(story?.rawInput ?? "");
  const [saving, setSaving] = useState(false);
  const [refining, setRefining] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveRawInput() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/story`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Failed to save");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function refine() {
    setRefining(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/story/refine`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json())?.error || "Failed to refine story");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refine story");
    } finally {
      setRefining(false);
    }
  }

  async function finalize() {
    setFinalizing(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/story/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneCount: 5 }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Failed to generate scenes");
      router.refresh();
      onScenesGenerated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate scenes");
    } finally {
      setFinalizing(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-xs text-neutral-500">Raw concept / story</label>
        <textarea
          className="bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm outline-none focus:border-neutral-600 min-h-32"
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={saveRawInput}
            disabled={saving}
            className="text-sm px-3 py-1.5 rounded border border-neutral-700 hover:border-neutral-500 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={refine}
            disabled={refining}
            className="text-sm px-3 py-1.5 rounded bg-neutral-100 text-neutral-900 font-medium disabled:opacity-50"
          >
            {refining ? "Refining…" : "Refine with AI"}
          </button>
        </div>
      </div>

      {story?.beatSheet != null && (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-neutral-500">Professional story review</label>
          <BeatSheetView beatSheet={story.beatSheet as BeatSheet} />
        </div>
      )}

      {story?.refinedText && (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-neutral-500">Refined narrative</label>
          <div className="text-sm text-neutral-300 whitespace-pre-wrap border border-neutral-800 rounded-lg p-3">
            {story.refinedText}
          </div>
          <button
            onClick={finalize}
            disabled={finalizing}
            className="self-start text-sm px-3 py-1.5 rounded bg-green-600 text-white font-medium disabled:opacity-50"
          >
            {finalizing ? "Generating scenes…" : "Finalize Story & Generate Scenes"}
          </button>
          {story.finalizedAt && (
            <p className="text-xs text-neutral-500">Finalized {new Date(story.finalizedAt).toLocaleString("en-US")}</p>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}

function BeatSheetView({ beatSheet }: { beatSheet: BeatSheet }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {BEAT_ORDER.map((key) => (
          <div key={key} className="border border-neutral-800 rounded-lg p-3">
            <div className="text-xs text-neutral-500 mb-1">{BEAT_LABELS[key]}</div>
            <div className="text-sm text-neutral-300">{beatSheet[key]}</div>
          </div>
        ))}
      </div>
      {beatSheet.craftNotes && (
        <div className="text-xs text-neutral-500 italic border-t border-neutral-800 pt-2">
          {beatSheet.craftNotes}
        </div>
      )}
    </div>
  );
}

function ScenesPanel({ projectId, scenes }: { projectId: string; scenes: ProjectDetail["scenes"] }) {
  if (scenes.length === 0) {
    return (
      <div className="text-sm text-neutral-500">
        No scenes yet — finalize the story in the Story tab to generate a scene breakdown.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {scenes.map((s) => {
        const scene = s.sceneJson as SceneJson;
        return (
          <a
            key={s.id}
            href={`/projects/${projectId}/scenes/${s.id}`}
            className="border border-neutral-800 rounded-lg p-4 flex flex-col gap-1 hover:border-neutral-600 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Scene {scene.index + 1} — {scene.storyBeat}
              </span>
              <span className="text-xs text-neutral-500">{scene.duration}s</span>
            </div>
            <p className="text-xs text-neutral-400">{scene.purpose}</p>
            <p className="text-xs text-neutral-500 mt-1">
              {scene.environment.description} · {scene.environment.lighting}
            </p>
            {scene.characters.length > 0 && (
              <p className="text-xs text-neutral-500">
                {scene.characters.map((c) => c.action).join(" · ")}
              </p>
            )}
          </a>
        );
      })}
    </div>
  );
}
