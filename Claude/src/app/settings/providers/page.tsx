import { listProviders } from "@/lib/providers/registry";
import type { ProviderCategory } from "@/lib/providers/types";

const CATEGORIES: { key: ProviderCategory; label: string }[] = [
  { key: "llm", label: "LLM / Story Intelligence" },
  { key: "image", label: "Image Generation" },
  { key: "video", label: "Video Generation" },
  { key: "voice", label: "Voice" },
  { key: "music", label: "Music" },
  { key: "lip-sync", label: "Lip Sync" },
  { key: "assets", label: "Stock Assets" },
];

export default function ProvidersSettings() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Providers</h1>
        <p className="text-neutral-400 mt-1 text-sm">
          Every category runs on a mock provider until its real adapter is connected with an API key.
          Nothing here is required to start building — see ARCHITECTURE.md §9 for the integration order.
        </p>
      </div>

      {CATEGORIES.map(({ key, label }) => {
        const rows = listProviders(key);
        return (
          <div key={key}>
            <h2 className="text-sm font-medium text-neutral-300 mb-2">{label}</h2>
            <div className="flex flex-col gap-2">
              {rows.map((p) => {
                const connected = p.isConfigured();
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border border-neutral-800 rounded-lg px-4 py-3"
                  >
                    <span className="text-sm">{p.name}</span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        connected ? "bg-green-900/40 text-green-400" : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {connected ? "Connected" : "Mock mode"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
