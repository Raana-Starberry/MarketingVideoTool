"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SceneJson } from "@/lib/scene/schema";
import { BEAT_ORDER, BEAT_LABELS, type BeatSheet } from "@/lib/scene/story-schema";

type ReferenceItem = {
  id: string;
  kind: string;
  label: string | null;
  url: string;
  characterId: string | null;
  environmentId: string | null;
  propId: string | null;
  clothingItemId: string | null;
};

type ProjectDetail = {
  id: string;
  prompt: string;
  visualBible: {
    characters: { id: string; name: string }[];
    environments: { id: string; name: string }[];
    props: { id: string; name: string }[];
    clothingItems: { id: string; name: string }[];
  } | null;
  references: ReferenceItem[];
  story: {
    rawInput: string;
    refinedText: string | null;
    beatSheet: unknown;
    finalizedAt: string | Date | null;
  } | null;
  scenes: { id: string; index: number; sceneJson: unknown }[];
  timelineClips: TimelineClipItem[];
};

type TimelineClipItem = {
  id: string;
  order: number;
  trimStartMs: number;
  trimEndMs: number | null;
  url: string | null;
};

const TABS = ["Story", "Scenes", "Timeline", "Captions", "Music"] as const;

export function ProjectTabs({ project }: { project: ProjectDetail }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Story");

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

      {tab === "Story" && (
        <StoryPanel
          projectId={project.id}
          story={project.story}
          visualBible={project.visualBible}
          references={project.references}
          onScenesGenerated={() => setTab("Scenes")}
        />
      )}

      {tab === "Scenes" && <ScenesPanel projectId={project.id} scenes={project.scenes} />}

      {tab === "Timeline" && <TimelinePanel clips={project.timelineClips} />}

      {(tab === "Captions" || tab === "Music") && (
        <div className="text-sm text-neutral-500">Coming in a later build phase — see ARCHITECTURE.md.</div>
      )}
    </div>
  );
}

function ReferenceGallery({ references }: { references: ReferenceItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function removeReference(referenceId: string) {
    setBusyId(referenceId);
    try {
      await fetch(`/api/references/${referenceId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (references.length === 0) {
    return <p className="text-xs text-neutral-600">No references uploaded yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {references.map((r) => (
        <div key={r.id} className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.url} alt={r.label ?? ""} className="w-20 h-20 object-cover rounded border border-neutral-800" />
          <button
            disabled={busyId === r.id}
            onClick={() => removeReference(r.id)}
            className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-red-600 text-white text-[10px] leading-none disabled:opacity-50"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function ReferenceUploader({
  projectId,
  visualBible,
}: {
  projectId: string;
  visualBible: ProjectDetail["visualBible"];
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [entity, setEntity] = useState("");
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [videoUrl, setVideoUrl] = useState("");
  const [videoEntity, setVideoEntity] = useState("");
  const [frameCount, setFrameCount] = useState(5);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const entityOptions = [
    ...(visualBible?.characters ?? []).map((c) => ({ type: "character", id: c.id, name: `Character: ${c.name}` })),
    ...(visualBible?.environments ?? []).map((e) => ({ type: "environment", id: e.id, name: `Environment: ${e.name}` })),
    ...(visualBible?.props ?? []).map((p) => ({ type: "prop", id: p.id, name: `Prop: ${p.name}` })),
    ...(visualBible?.clothingItems ?? []).map((c) => ({ type: "clothingItem", id: c.id, name: `Clothing: ${c.name}` })),
  ];

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    setUploadProgress({ done: 0, total: files.length });
    try {
      const [entityType, entityId] = entity ? entity.split(":") : [undefined, undefined];

      for (let i = 0; i < files.length; i++) {
        const form = new FormData();
        form.append("file", files[i]);
        form.append("kind", "OTHER");
        if (label) form.append("label", files.length > 1 ? `${label} (${i + 1})` : label);
        if (entityType && entityId) {
          form.append("entityType", entityType);
          form.append("entityId", entityId);
        }

        const res = await fetch(`/api/projects/${projectId}/references`, { method: "POST", body: form });
        if (!res.ok) throw new Error((await res.json())?.error || `Upload failed on file ${i + 1} of ${files.length}`);
        setUploadProgress({ done: i + 1, total: files.length });
      }

      setFiles([]);
      setLabel("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function captureFromVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!videoUrl) return;
    setCapturing(true);
    setCaptureError(null);
    try {
      const [entityType, entityId] = videoEntity ? videoEntity.split(":") : [undefined, undefined];
      const res = await fetch(`/api/projects/${projectId}/references/from-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: videoUrl,
          frameCount,
          ...(entityType && entityId ? { entityType, entityId } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Failed to capture frames");
      setVideoUrl("");
      router.refresh();
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : "Failed to capture frames");
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div className="border border-neutral-800 rounded-lg p-4 flex flex-col gap-5">
      <form onSubmit={upload} className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-neutral-300">Upload references</h3>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
          className="text-xs text-neutral-400"
        />
        {files.length > 0 && (
          <p className="text-xs text-neutral-500">
            {files.length} file{files.length === 1 ? "" : "s"} selected
            {uploadProgress ? ` — uploading ${uploadProgress.done}/${uploadProgress.total}` : ""}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <select
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-xs"
          >
            <option value="">General reference (not linked)</option>
            {entityOptions.map((o) => (
              <option key={`${o.type}:${o.id}`} value={`${o.type}:${o.id}`}>
                {o.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-xs flex-1 min-w-32"
          />
        </div>
        <button
          type="submit"
          disabled={files.length === 0 || uploading}
          className="self-start text-sm px-3 py-1.5 rounded bg-neutral-100 text-neutral-900 font-medium disabled:opacity-50"
        >
          {uploading
            ? `Uploading ${uploadProgress?.done ?? 0}/${uploadProgress?.total ?? files.length}…`
            : files.length > 1
              ? `Upload ${files.length} files`
              : "Upload"}
        </button>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </form>

      <div className="border-t border-neutral-800 pt-4">
        <form onSubmit={captureFromVideo} className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-medium text-neutral-300">Capture from a video link</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Paste a direct video file URL (.mp4/.webm/…) — a few frames are pulled from it automatically as
              reference stills. YouTube/Twitch watch-page links aren&apos;t supported yet.
            </p>
          </div>
          <input
            type="url"
            required
            placeholder="https://example.com/gameplay-clip.mp4"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-xs"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={videoEntity}
              onChange={(e) => setVideoEntity(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5 text-xs"
            >
              <option value="">General reference (not linked)</option>
              {entityOptions.map((o) => (
                <option key={`${o.type}:${o.id}`} value={`${o.type}:${o.id}`}>
                  {o.name}
                </option>
              ))}
            </select>
            <label className="text-xs text-neutral-500 flex items-center gap-1.5">
              Frames
              <select
                value={frameCount}
                onChange={(e) => setFrameCount(Number(e.target.value))}
                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs"
              >
                {[3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={!videoUrl || capturing}
            className="self-start text-sm px-3 py-1.5 rounded bg-neutral-100 text-neutral-900 font-medium disabled:opacity-50"
          >
            {capturing ? "Capturing frames…" : "Capture frames"}
          </button>
          {captureError && <p className="text-red-400 text-xs">{captureError}</p>}
        </form>
      </div>
    </div>
  );
}

function StoryPanel({
  projectId,
  story,
  visualBible,
  references,
  onScenesGenerated,
}: {
  projectId: string;
  story: ProjectDetail["story"];
  visualBible: ProjectDetail["visualBible"];
  references: ReferenceItem[];
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

      <div className="border-t border-neutral-800 pt-4 flex flex-col gap-3">
        <ReferenceUploader projectId={projectId} visualBible={visualBible} />
        <ReferenceGallery references={references} />
      </div>
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

function TimelinePanel({ clips }: { clips: TimelineClipItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function move(clipId: string, direction: "up" | "down") {
    setBusyId(clipId);
    try {
      await fetch(`/api/timeline-clips/${clipId}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(clipId: string) {
    setBusyId(clipId);
    try {
      await fetch(`/api/timeline-clips/${clipId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function updateTrim(clipId: string, trimStartMs: number, trimEndMs: number | null) {
    await fetch(`/api/timeline-clips/${clipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trimStartMs, trimEndMs }),
    });
    router.refresh();
  }

  if (clips.length === 0) {
    return (
      <div className="text-sm text-neutral-500">
        No clips yet — open a scene and use &quot;Add to Timeline&quot; on a generated image to start building
        the sequence.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 overflow-x-auto pb-2">
        {clips.map((clip) => (
          <div key={clip.id} className="flex-shrink-0 w-16 h-16">
            {clip.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clip.url} alt="" className="w-full h-full object-cover rounded border border-neutral-700" />
            ) : (
              <div className="w-full h-full rounded border border-neutral-800 bg-neutral-900" />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {clips.map((clip, i) => (
          <div key={clip.id} className="border border-neutral-800 rounded-lg p-3 flex items-center gap-3">
            <span className="text-xs text-neutral-500 w-6">#{i + 1}</span>
            {clip.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clip.url} alt="" className="w-12 h-12 object-cover rounded border border-neutral-800" />
            ) : (
              <div className="w-12 h-12 rounded border border-neutral-800 bg-neutral-900" />
            )}
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <label className="flex items-center gap-1">
                Trim start (ms)
                <input
                  type="number"
                  min={0}
                  defaultValue={clip.trimStartMs}
                  onBlur={(e) => updateTrim(clip.id, Number(e.target.value), clip.trimEndMs)}
                  className="w-20 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-1"
                />
              </label>
              <label className="flex items-center gap-1">
                Trim end (ms)
                <input
                  type="number"
                  min={0}
                  defaultValue={clip.trimEndMs ?? ""}
                  placeholder="none"
                  onBlur={(e) => updateTrim(clip.id, clip.trimStartMs, e.target.value ? Number(e.target.value) : null)}
                  className="w-20 bg-neutral-900 border border-neutral-800 rounded px-1.5 py-1"
                />
              </label>
            </div>
            <div className="flex gap-1 ml-auto">
              <button
                disabled={busyId === clip.id || i === 0}
                onClick={() => move(clip.id, "up")}
                className="text-xs px-2 py-1 rounded border border-neutral-700 hover:border-neutral-500 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                disabled={busyId === clip.id || i === clips.length - 1}
                onClick={() => move(clip.id, "down")}
                className="text-xs px-2 py-1 rounded border border-neutral-700 hover:border-neutral-500 disabled:opacity-30"
              >
                ↓
              </button>
              <button
                disabled={busyId === clip.id}
                onClick={() => remove(clip.id)}
                className="text-xs px-2 py-1 rounded border border-red-900 text-red-400 hover:border-red-700 disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
