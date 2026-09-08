"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STYLE_OPTIONS } from "@/lib/scene/styles";

export function StyleSelector({ projectId, value }: { projectId: string; value: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function onChange(renderStyle: string) {
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/style`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renderStyle }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <label className="text-sm text-neutral-400">Style</label>
      <select
        value={value}
        disabled={saving}
        onChange={(e) => onChange(e.target.value)}
        className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm text-neutral-300 disabled:opacity-50"
      >
        {STYLE_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <p className="text-xs text-neutral-600">Locked across every generated scene — see ARCHITECTURE.md §8.</p>
    </div>
  );
}
