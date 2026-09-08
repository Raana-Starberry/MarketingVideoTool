"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Variation = { id: string; status: "PENDING" | "SELECTED" | "FAVORITE" | "REJECTED"; url: string };
type Generation = { id: string; status: string; createdAt: string; variations: Variation[] };

const STATUS_LABELS: Record<Variation["status"], string> = {
  PENDING: "Pending",
  SELECTED: "Selected",
  FAVORITE: "Favorite",
  REJECTED: "Rejected",
};

export function SceneGenerationPanel({
  projectId,
  sceneId,
  initialGenerations,
}: {
  projectId: string;
  sceneId: string;
  initialGenerations: Generation[];
}) {
  const router = useRouter();
  const [variationCount, setVariationCount] = useState(2);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/scenes/${sceneId}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variationCount }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Generation failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function setStatus(variationId: string, status: Variation["status"]) {
    setUpdatingId(variationId);
    try {
      const res = await fetch(`/api/generation-variations/${variationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Failed to update");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setUpdatingId(null);
    }
  }

  async function addToTimeline(variationId: string) {
    setUpdatingId(variationId);
    try {
      const res = await fetch(`/api/projects/${projectId}/timeline/clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variationId }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Failed to add to timeline");
      setAddedIds((prev) => new Set(prev).add(variationId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add to timeline");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label className="text-xs text-neutral-500">Variations</label>
        <select
          value={variationCount}
          onChange={(e) => setVariationCount(Number(e.target.value))}
          className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm"
        >
          {[1, 2, 4].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button
          onClick={generate}
          disabled={generating}
          className="text-sm px-3 py-1.5 rounded bg-neutral-100 text-neutral-900 font-medium disabled:opacity-50"
        >
          {generating ? "Generating…" : "Generate Image"}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {initialGenerations.length === 0 ? (
        <p className="text-sm text-neutral-500">No generations yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {initialGenerations.map((gen) => (
            <div key={gen.id} className="flex flex-col gap-2">
              <div className="text-xs text-neutral-500">
                {new Date(gen.createdAt).toLocaleString("en-US")} · {gen.status}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {gen.variations.map((v) => (
                  <div key={v.id} className="border border-neutral-800 rounded-lg overflow-hidden flex flex-col">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.url} alt="" className="w-full aspect-square object-cover bg-neutral-900" />
                    <div className="p-2 flex flex-col gap-1">
                      <span className="text-xs text-neutral-500">{STATUS_LABELS[v.status]}</span>
                      <div className="flex gap-1 flex-wrap">
                        <button
                          disabled={updatingId === v.id}
                          onClick={() => setStatus(v.id, "SELECTED")}
                          className="text-xs px-2 py-1 rounded border border-neutral-700 hover:border-neutral-500 disabled:opacity-50"
                        >
                          Select
                        </button>
                        <button
                          disabled={updatingId === v.id}
                          onClick={() => setStatus(v.id, "FAVORITE")}
                          className="text-xs px-2 py-1 rounded border border-neutral-700 hover:border-neutral-500 disabled:opacity-50"
                        >
                          Favorite
                        </button>
                        <button
                          disabled={updatingId === v.id}
                          onClick={() => setStatus(v.id, "REJECTED")}
                          className="text-xs px-2 py-1 rounded border border-neutral-700 hover:border-neutral-500 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          disabled={updatingId === v.id}
                          onClick={() => addToTimeline(v.id)}
                          className="text-xs px-2 py-1 rounded border border-neutral-700 hover:border-neutral-500 disabled:opacity-50"
                        >
                          {addedIds.has(v.id) ? "Added ✓" : "Add to Timeline"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
