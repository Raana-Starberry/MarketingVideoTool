# AI Marketing Creative Video Generator — Architecture

Status: MVP scaffold in progress. This document is the source of truth for architecture decisions. Update it as the system evolves.

## 1. Recommended Technical Architecture

Single full-stack TypeScript app for the MVP (simplest path to a working product; can be split into
services later without changing the provider/domain layers).

```
Next.js 14 (App Router) + TypeScript
  ├─ UI: React + Tailwind CSS + shadcn/ui
  ├─ Server logic: Next.js Route Handlers + a typed service layer (tRPC-style, framework-agnostic)
  ├─ Validation: Zod (also generates the Scene JSON schema types)
  ├─ ORM: Prisma → PostgreSQL
  ├─ File storage: StorageProvider abstraction (local disk in dev → S3-compatible in prod)
  ├─ Async jobs: GenerationJob table + a lightweight worker loop (upgradeable to BullMQ/Redis)
  └─ Providers: Image / Video / Voice / Music / LipSync — all behind interfaces, mock-first
```

Why this stack: everything ships in one deployable app for MVP speed, but the **layer boundaries**
(below) are the same boundaries you'd use if this became several services later. Nothing in the
provider layer, consistency engine, or scene-JSON engine depends on Next.js.

Layered flow (as specified):

```
Frontend (React)
  ↓
API layer (Route Handlers)
  ↓
Project / Asset Management (Prisma repositories)
  ↓
Story & Scene Planner (LLM-backed, mock-first)
  ↓
Consistency Engine (Visual Bible + continuity tracking)
  ↓
Prompt / Scene JSON Engine (Zod schema + prompt builders)
  ↓
Generation Orchestrator (creates GenerationJobs, injects consistency context)
  ↓
Provider Layer (Image / Video / Voice / Music / LipSync — interface + registry)
  ↓
Asset Storage (StorageProvider)
  ↓
Timeline / Rendering Engine (ffmpeg-based export)
```

## 2. Database / Data Model

Implemented in `prisma/schema.prisma`. Summary of entities:

- **Project** — top-level container. Has one `VisualBible`, one `Story`, many `Scene`s, `Reference`s,
  `AudioTrack`s, one `Timeline`, `ProviderConfig` overrides, `GenerationJob`s.
- **VisualBible** — canonical consistency profile: `Character[]`, `ClothingItem[]`, `Environment[]`,
  `Prop[]`, `StyleProfile` (rendering style, color palette, lighting direction).
- **Reference** — uploaded file (character sheet, env ref, prop, camera ref…) with a `kind` tag and
  optional link to a Character/Environment/Prop in the Visual Bible.
- **Story** — raw prompt, refined story text, revision history.
- **Scene** — belongs to Project, ordered `index`, holds the structured `sceneJson` (jsonb, validated
  against the Zod Scene schema at write time), plus `continuityIn`/`continuityOut` snapshots.
- **Generation** — one request to a provider (image or video) for a Scene: provider id, model,
  input params, status, cost fields. Has many `GenerationVariation`s (the actual outputs).
- **GenerationVariation** — one output asset + `status`: `pending | selected | favorite | rejected`.
- **Asset** — stored file record (image/video/audio), with storage key, dimensions/duration, checksum.
- **GenerationJob** — async job envelope wrapping a Generation (see §22 job model below).
- **ProviderConfig** — per-project or global provider enablement/defaults (no secrets stored here —
  secrets live only in env vars; this table stores `enabled`, `isDefault`, `lastVerifiedAt`).
- **Timeline** — ordered `TimelineClip[]` referencing selected `GenerationVariation`s, plus
  `CaptionTrack`, `AudioTrack`s (music/dialogue/sfx), transitions.
- **CaptionTrack / CaptionSegment** — timing, text, per-project or per-clip style overrides.
- **MusicSelection** — manual upload or AI-generated request tied to the Timeline.

Prisma schema is the executable version of this; see `prisma/schema.prisma`.

## 3. Project / File Structure

```
Claude/
├─ ARCHITECTURE.md
├─ .env.example
├─ .gitignore
├─ docker-compose.yml
├─ prisma/
│  └─ schema.prisma
├─ src/
│  ├─ app/                        # Next.js routes (UI + API)
│  │  ├─ projects/[id]/           # Project workspace (tabs: brief, bible, story, scenes, timeline…)
│  │  ├─ settings/providers/      # Provider connection management screen
│  │  └─ api/                     # Route Handlers (thin — delegate to lib/server)
│  ├─ components/                 # Reusable UI
│  ├─ lib/
│  │  ├─ db/                      # Prisma client + repositories
│  │  ├─ scene/                   # Scene JSON Zod schema + prompt builders
│  │  ├─ consistency/             # Visual Bible + continuity engine
│  │  ├─ orchestrator/            # Generation orchestrator, job creation
│  │  ├─ jobs/                    # GenerationJob worker + queue abstraction
│  │  ├─ storage/                 # StorageProvider interface + local/S3 impls
│  │  └─ providers/
│  │     ├─ registry.ts           # Provider registry + capability lookup
│  │     ├─ image/                # ImageProvider interface, mock, nano-banana (Gemini)
│  │     ├─ video/                # VideoProvider interface, mock, kling/veo/higgsfield stubs
│  │     ├─ voice/                # VoiceProvider interface, mock, elevenlabs stub
│  │     ├─ music/                # MusicProvider interface, mock
│  │     ├─ lipsync/              # LipSyncProvider interface, mock
│  │     └─ assets/                # Stock/asset provider interface (Envato), mock
│  └─ types/                      # Shared TS types
└─ worker/                        # Optional standalone job-runner entry point (same code as lib/jobs)
```

## 4. Scene JSON Schema

Defined with Zod in `src/lib/scene/schema.ts` (Zod is the runtime validator; TS types are inferred
from it, so the schema is always in sync with the types). Shape:

```ts
SceneSchema = {
  sceneId: string
  index: number
  duration: number                 // seconds; must fit selected VideoProvider's supportedDurations
  storyBeat: string
  purpose: string

  characters: Array<{
    characterRef: string           // id into VisualBible.characters
    appearanceOverride?: string
    clothingRef?: string
    position?: string
    action: string
    facialExpression?: string
    dialogue?: { text: string; emotion?: string; language?: string }
  }>

  environment: {
    environmentRef?: string        // id into VisualBible.environments
    description: string
    background?: string
    props: string[]                // ids into VisualBible.props
    timeOfDay?: string
    lighting: string
  }

  camera: {
    angle?: string
    lens?: string
    position?: string
    movement?: string
    framing?: string
    composition?: string
    depthOfField?: string
  }

  action: {
    characterMovement?: string
    environmentalMovement?: string
    physics?: string               // explicit physical-plausibility constraints
  }

  continuity: {
    previousSceneId?: string
    startFrameDescription: string
    endFrameDescription: string
    matchCut?: boolean
    eyeline?: string
    cameraDirection?: string
  }

  transition: {
    toNextSceneId?: string
    type?: string                  // cut | match-cut | dissolve | ...
  }

  style: {
    visualStyle: string            // must match Project.VisualBible.style unless explicitly overridden
    colorPalette?: string[]
  }

  generation: {
    imagePrompt: string
    videoPrompt: string
    negativePrompt?: string
  }

  audio: {
    dialogue?: string
    soundEffects?: string[]
    musicDirection?: string
  }

  caption?: {
    text?: string
    timingHint?: string
  }
}
```

This is the **source of truth** passed to the Prompt/Scene JSON Engine, which renders it into the
concrete request shape each provider expects (via each provider adapter's `buildRequest(scene, visualBible, continuity)`).

## 5. Provider Abstraction Design

Every capability (image, video, voice, music, lip-sync, stock assets) is behind an interface + a
capability descriptor, registered in a central registry. UI reads `getCapabilities()` to decide what
controls to show (durations, aspect ratios, first/last-frame support, etc.) — nothing about a specific
provider is hard-coded into the UI.

```ts
interface ImageProvider {
  id: string; name: string; category: "image";
  getCapabilities(): ImageCapabilities;
  generateImage(req: ImageGenerationRequest): Promise<GenerationResult>;
  isConfigured(): boolean;          // true once required env vars are present
}

interface VideoProvider {
  id: string; name: string; category: "video";
  getCapabilities(): VideoCapabilities;
  generateVideo(req: VideoGenerationRequest): Promise<GenerationResult>;
  isConfigured(): boolean;
}

interface VideoCapabilities {
  textToVideo: boolean;
  imageToVideo: boolean;
  firstFrameReference: boolean;
  lastFrameReference: boolean;
  characterReference: boolean;
  nativeAudio: boolean;
  nativeLipSync: boolean;
  supportedDurations: number[];
  supportedAspectRatios: string[];
  maxResolution?: string;
  cameraControls?: boolean;
  maxPromptLength?: number;
}

interface VoiceProvider { id, name, category: "voice", getCapabilities(), generateSpeech(req), isConfigured() }
interface MusicProvider { id, name, category: "music", getCapabilities(), generateMusic(req), isConfigured() }
interface LipSyncProvider { id, name, category: "lip-sync", generate(video: Asset, audio: Asset): Promise<GenerationResult>, isConfigured() }
interface AssetProvider  { id, name, category: "assets", search(query), fetch(assetId), isConfigured() }
```

Registry (`lib/providers/registry.ts`) holds all registered adapters per category and exposes:
`list(category)`, `get(id)`, `getDefault(category)`. Every provider ships a **mock implementation**
that returns a placeholder asset instantly — the app is fully usable end-to-end with zero API keys.
Real adapters (Gemini/Nano Banana, Kling, Veo, Higgsfield, ElevenLabs, Envato…) are added one at a
time, each reading its own env vars and reporting `isConfigured()` accurately. `ProviderConfig` in the
DB never stores secrets — only enablement/default flags; secrets live exclusively in env vars read
server-side.

## 6. Main UI Screens

1. **Projects Dashboard** — list/create/delete projects, thumbnail from latest export or hero image.
2. **Project Workspace** (tabbed, per project):
   - **Brief** — original prompt, style selection, project settings.
   - **Visual Bible** — characters, clothing, environments, props, style/palette, each with reference
     image upload.
   - **Story** — story editor + refine-with-AI panel; "Finalize Story" triggers scene breakdown.
   - **Scenes** — scene list/board; each scene card shows status (draft JSON / image gen / video gen /
     selected). Opens **Scene Detail**.
   - **Scene Detail** — Scene JSON viewer/editor (structured form, not raw JSON for normal use),
     reference picker, image generation panel (provider/model select, variations grid with
     select/favorite/reject/regenerate), video generation panel (provider-driven dynamic controls).
   - **Timeline** — drag-drop clip ordering, trim/split, per-clip variation swap, transitions,
     caption/music/dialogue tracks, preview, export.
   - **Captions** — global caption style defaults + per-clip overrides.
   - **Music** — manual upload/select or AI-generate request, attach to timeline.
3. **Generation Jobs Panel** (global, persistent) — live progress across all in-flight jobs, so the
   project stays usable while generations run.
4. **Settings → Providers** — per-provider card: connection status, Connect/Configure/Test
   connection/Disable/Set as default, capability summary. Never displays the raw secret once stored.

## 7. Generation Workflow

```
Concept → Project → Story → Professional Story Review (beat sheet) → Scene Breakdown → Scene JSON
   → Image Generation (per scene, N variations)
   → Video Generation (image-to-video from selected image, provider-capability-aware)
   → Review Variations → Select/Favorite
   → Timeline assembly → Captions → Music
   → Final Export (ffmpeg render of selected clips + audio + captions)
```

**Professional Story Review**: before scene breakdown, `refineStory()` (src/lib/scene/planner.ts) runs
the concept through a fixed 6-beat short-form trailer structure — Hook, Setup, Inciting Incident,
Rising Action, Climax, Resolution (src/lib/scene/story-schema.ts) — rather than a generic rewrite. The
result (`Story.beatSheet`) is shown in the Story tab as a structured review, and scene breakdown
allocates each generated scene to one beat in sequence (`allocateBeats()`), so the story's dramatic
shape — not just its prose — drives what gets shot.

Every generation call is created as a `Generation` + wrapped in a `GenerationJob` (§22) so the UI never
blocks on a long-running request. The Orchestrator is the only thing that talks to providers — it:
1. Loads the Scene JSON, Visual Bible, and continuity data (previous scene's end-frame/pose/eyeline).
2. Builds the provider-specific request via the Prompt/Scene JSON Engine.
3. Creates the `GenerationJob`, enqueues it, updates status as the (mock or real) provider progresses.
4. On completion, stores the resulting `Asset`(s) as `GenerationVariation`(s) linked to the Scene.

## 8. Consistency Strategy

- **Visual Bible is canonical.** Every image/video prompt is built by merging: Scene JSON + referenced
  Character/Clothing/Environment/Prop entries + Project `StyleProfile`. Scenes never define style from
  scratch — they reference the Bible.
- **Continuity object** carried scene-to-scene: previous scene's end-frame description, character
  pose, eyeline, camera direction/position, lighting, active props. The Scene Planner populates a new
  scene's `continuity.startFrameDescription` from the prior scene's `continuity.endFrameDescription`
  automatically, and flags `matchCut` when appropriate.
- **Reference bundling**: every generation request includes the relevant Visual Bible reference images
  (character sheet, environment refs) alongside the previous scene's selected end-frame, when the
  provider supports image/character references. Capability registry determines what's actually sent.
- **Style lock**: `visualStyle` is fixed at the project level; changing it requires an explicit user
  action and is never inferred mid-project. A generation whose provider/model can't honor the current
  style is flagged in the UI rather than silently drifting.
- **Reject/regenerate loop**: any variation that visibly breaks consistency is rejected by the user
  (manually now; automated consistency scoring is a documented post-MVP enhancement, not blocking).

## 9. MVP Implementation Phases

| Phase | Deliverable | External keys needed |
|---|---|---|
| 0 | Scaffold: Next.js/TS/Tailwind/Prisma, folder structure, provider interfaces + **mock** adapters for every category, env var placeholders, `.env.example` | None |
| 1 | Project CRUD, Visual Bible editor, reference upload, style selection | None |
| 2 | Story editor + AI refine + scene breakdown + Scene JSON generation (mock LLM until this stage is ready to go live) | `ANTHROPIC_API_KEY` (or chosen LLM) — asked for at this stage only |
| 3 | Scene Detail UI + image generation wired to mock ImageProvider, variations grid, select/favorite/reject | None (mock) |
| 3b | Real image provider: Gemini / Nano Banana adapter | `GEMINI_API_KEY` — asked for at this stage only |
| 4 | Video generation UI, capability-driven controls, wired to mock VideoProvider | None (mock) |
| 4b | Real video provider(s): Kling → Veo → Higgsfield, added one at a time | Provider-specific key, asked for when that adapter is implemented |
| 5 | Generation Jobs panel (async status/progress), cost fields on Generation records | None |
| 6 | Timeline editor: ordering, trim/split, variation swap, transitions | None |
| 7 | Captions system | None |
| 8 | Music: manual upload working first; AI music provider stubbed with mock | Music provider key, when implemented |
| 8b | Voice/dialogue: ElevenLabs adapter | `ELEVENLABS_API_KEY`, asked for at this stage only |
| 8c | Lip-sync provider (native via video provider, or standalone) | Provider-specific, if a standalone service is needed |
| 9 | Stock assets: Envato adapter | `ENVATO_API_KEY`, asked for at this stage only |
| 10 | Final export pipeline (ffmpeg render), Settings → Providers screen, cost summary display | None |

**Rule for the whole build:** every phase above ships with mock providers first and is fully usable
without any credentials. A real provider is integrated — and a key requested, with the exact env var
name, where to get it, and how we'll test it — only when its phase is reached. Missing keys never
block unrelated work.

## Async Generation Job Model

```ts
GenerationJob {
  id, projectId, sceneId, generationId,
  provider, model, type: "image" | "video" | "voice" | "music" | "lip-sync",
  status: "queued" | "preparing" | "generating" | "processing" | "completed" | "failed" | "cancelled",
  progress: number,        // 0-100, provider-reported where available, else phase-estimated
  request: jsonb, result: jsonb, error: string?,
  costEstimate?, costActual?,
  createdAt, startedAt, completedAt
}
```

MVP job runner: a DB-backed queue (`GenerationJob` rows + a poll loop) — no Redis dependency required
to start. `lib/jobs/queue.ts` exposes an interface (`enqueue`, `subscribe`) so it can be swapped for
BullMQ/Redis later without touching callers.

## Provider Configuration & Secrets

- All secrets live in `.env.local` (gitignored), never in source, never sent to the browser.
- `.env.example` documents every variable with an empty value.
- `ProjectProviderConfig` DB rows store only `isDefault` — never the secret.
- All provider calls happen server-side (Route Handlers / server actions) — the browser never talks to
  Kling/Gemini/ElevenLabs/etc. directly.
- Settings → Providers reads `provider.isConfigured()` (server-side env check) to render connection
  status; "Test connection" triggers a minimal real request server-side and reports success/failure.
