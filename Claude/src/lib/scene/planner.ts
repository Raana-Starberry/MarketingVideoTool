import { prisma } from "@/lib/db/client";
import { getDefaultProvider } from "@/lib/providers/registry";
import type { LLMProvider } from "@/lib/providers/types";
import { SceneSchema, type SceneJson } from "./schema";
import { BeatSheetSchema, BEAT_ORDER, BEAT_LABELS, type BeatSheet } from "./story-schema";

/**
 * Story & Scene Planner (ARCHITECTURE.md §4, §7, §8). Turns a raw/refined
 * story into: (1) a professional story-structure beat sheet, (2) a Visual
 * Bible extracted from it, and (3) a sequence of Scene JSON records —
 * continuity-chained and each grounded in one beat of the story arc.
 *
 * Runs against whichever LLM provider is configured (mock-first — see
 * ARCHITECTURE.md §9). The mock path uses local heuristics instead of
 * parsing free-form JSON, so this whole flow works with zero API keys.
 */

interface EntityDraft {
  name: string;
  description: string;
}

interface EntitiesDraft {
  characters: EntityDraft[];
  environments: EntityDraft[];
  props: EntityDraft[];
}

interface SceneDraft {
  storyBeat: string;
  purpose: string;
  durationSeconds: number;
  characterNames: string[];
  characterActions: Record<string, string>;
  environmentName: string;
  environmentDescription: string;
  lighting: string;
  timeOfDay?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  framing?: string;
  startFrameDescription: string;
  endFrameDescription: string;
  imagePrompt: string;
  videoPrompt: string;
  negativePrompt?: string;
  dialogue?: string;
  soundEffects?: string[];
  musicDirection?: string;
}

export interface StoryRefinement {
  narrative: string;
  beatSheet: BeatSheet;
}

function isMock(llm: LLMProvider) {
  return llm.id === "mock-llm";
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(trimmed);
}

/**
 * Assigns each of `sceneCount` scenes to one beat of the 6-beat story arc,
 * always opening on the hook and closing on the resolution. Extra scenes
 * (beyond 6) pad out the rising action, since that's where marketing
 * trailers typically spend the most screen time.
 */
function allocateBeats(sceneCount: number): (typeof BEAT_ORDER)[number][] {
  if (sceneCount <= BEAT_ORDER.length) {
    return Array.from({ length: sceneCount }, (_, i) => {
      const idx = Math.round((i * (BEAT_ORDER.length - 1)) / Math.max(sceneCount - 1, 1));
      return BEAT_ORDER[idx];
    });
  }
  const extra = sceneCount - BEAT_ORDER.length;
  const risingIdx = BEAT_ORDER.indexOf("risingAction");
  const result = [...BEAT_ORDER];
  result.splice(risingIdx + 1, 0, ...Array.from({ length: extra }, () => "risingAction" as const));
  return result;
}

export async function refineStory(rawInput: string, visualStyle: string): Promise<StoryRefinement> {
  const llm = getDefaultProvider("llm") as LLMProvider;

  if (isMock(llm)) {
    const beatSheet: BeatSheet = {
      hook: `Cold open on a striking, unexplained image that plants a question in the viewer's mind, drawn from: "${rawInput.slice(0, 80)}..."`,
      setup: `Quickly establish who the hero is and the world of this ${visualStyle} concept.`,
      incitingIncident: "The central threat or challenge from the concept appears and disrupts the status quo.",
      risingAction: "Stakes escalate through a sequence of increasingly intense confrontations.",
      climax: "The hero's defining action/power-move moment — the emotional and visual peak of the trailer.",
      resolution: "A final sting that resolves the immediate beat while leaving a hook for the full game.",
      craftNotes: "Mock beat sheet — heuristic only, not LLM-reviewed. Configure GEMINI_API_KEY for a real professional story pass.",
    };
    const narrative = BEAT_ORDER.map((k) => beatSheet[k]).join(" ");
    return { narrative, beatSheet };
  }

  const { text } = await llm.generateText({
    jsonMode: true,
    prompt: [
      "You are a professional story consultant specializing in short-form game marketing trailers (15-45 seconds).",
      "Review the concept below the way a trailer editor/showrunner would: find the strongest hook, cut anything that doesn't serve pace, and shape it into a proven short-form arc.",
      `Target visual style: ${visualStyle}.`,
      "",
      "Apply this exact 6-beat structure (each 1-2 punchy sentences, concrete and visual — no abstractions):",
      "- hook: the first thing on screen that grabs attention before anything is explained",
      "- setup: who/where, established as fast as possible",
      "- incitingIncident: the moment the central conflict/threat kicks in",
      "- risingAction: escalation — stakes and intensity climbing",
      "- climax: the single biggest payoff/power moment of the trailer",
      "- resolution: the closing beat/sting that leaves a hook for the full game",
      "",
      "Also include craftNotes: 2-3 sentences explaining the storytelling choices you made and why they work for this format.",
      "",
      "Return ONLY valid JSON matching this exact shape, no prose outside the JSON:",
      `{"hook":string,"setup":string,"incitingIncident":string,"risingAction":string,"climax":string,"resolution":string,"craftNotes":string}`,
      "",
      `Concept: ${rawInput}`,
    ].join("\n"),
  });

  const beatSheet = BeatSheetSchema.parse(extractJson(text));
  const narrative = BEAT_ORDER.map((k) => beatSheet[k]).join(" ");
  return { narrative, beatSheet };
}

async function extractEntities(refinedStory: string, llm: LLMProvider): Promise<EntitiesDraft> {
  if (isMock(llm)) {
    return {
      characters: [
        {
          name: "Protagonist",
          description: "The story's hero — appearance to be refined once concept art references are added.",
        },
      ],
      environments: [
        {
          name: "Main Setting",
          description: refinedStory.slice(0, 160),
        },
      ],
      props: [],
    };
  }

  const { text } = await llm.generateText({
    jsonMode: true,
    prompt: [
      "Extract a Visual Bible from this game-marketing story: the distinct characters, environments, and key props that appear.",
      "Return ONLY valid JSON matching this exact shape, no prose:",
      `{"characters":[{"name":string,"description":string}],"environments":[{"name":string,"description":string}],"props":[{"name":string,"description":string}]}`,
      "Keep descriptions concrete and visual (appearance, proportions, materials, colors) — these become a persistent reference other scenes must match.",
      "",
      `Story: ${refinedStory}`,
    ].join("\n"),
  });

  const parsed = extractJson(text) as EntitiesDraft;
  return {
    characters: parsed.characters ?? [],
    environments: parsed.environments ?? [],
    props: parsed.props ?? [],
  };
}

async function breakdownScenes(
  refinedStory: string,
  beatSheet: BeatSheet,
  entities: EntitiesDraft,
  sceneCount: number,
  visualStyle: string,
  llm: LLMProvider
): Promise<SceneDraft[]> {
  const beatPlan = allocateBeats(sceneCount);

  if (isMock(llm)) {
    const character = entities.characters[0]?.name ?? "Protagonist";
    const environment = entities.environments[0]?.name ?? "Main Setting";
    return beatPlan.map((beatKey, i) => ({
      storyBeat: BEAT_LABELS[beatKey],
      purpose: beatSheet[beatKey],
      durationSeconds: 5,
      characterNames: [character],
      characterActions: { [character]: beatSheet[beatKey] },
      environmentName: environment,
      environmentDescription: `${environment}, ${BEAT_LABELS[beatKey].toLowerCase()} beat`,
      lighting: "dramatic, high contrast",
      cameraAngle: i % 2 === 0 ? "low angle" : "eye level",
      cameraMovement: "slow push in",
      framing: "medium shot",
      startFrameDescription: `Scene ${i + 1} (${BEAT_LABELS[beatKey]}) opens on ${character} in ${environment}.`,
      endFrameDescription: `Scene ${i + 1} (${BEAT_LABELS[beatKey]}) ends with ${character} turning toward the next beat.`,
      imagePrompt: `${visualStyle} key art: ${character} in ${environment} — ${BEAT_LABELS[beatKey]} beat.`,
      videoPrompt: `${visualStyle} short clip: ${character} in ${environment}, camera slow push in — ${BEAT_LABELS[beatKey]} beat.`,
      soundEffects: [],
    }));
  }

  const { text } = await llm.generateText({
    jsonMode: true,
    prompt: [
      `Turn this professionally-structured story into exactly ${sceneCount} sequential scenes/shots for a ${visualStyle} game-marketing video.`,
      "The story's beat sheet (already reviewed for pacing):",
      ...BEAT_ORDER.map((k) => `- ${BEAT_LABELS[k]}: ${beatSheet[k]}`),
      "",
      `Assign scenes to beats in this exact order (one beat per scene index, in sequence): ${beatPlan.map((b, i) => `#${i + 1}=${BEAT_LABELS[b]}`).join(", ")}.`,
      "Each scene's `storyBeat` field must be that scene's beat name, and `purpose` must state what that beat needs to accomplish dramatically here.",
      "Use only these established characters and environments (by name):",
      `Characters: ${entities.characters.map((c) => c.name).join(", ") || "(none)"}`,
      `Environments: ${entities.environments.map((e) => e.name).join(", ") || "(none)"}`,
      "Each scene must flow from the previous one's ending — describe endFrameDescription so the next scene's action can continue naturally from it, and pacing should tighten (shorter, punchier) as it approaches the climax.",
      "Return ONLY a valid JSON array, no prose, matching this shape per item:",
      `{"storyBeat":string,"purpose":string,"durationSeconds":number,"characterNames":string[],"characterActions":{[name:string]:string},"environmentName":string,"environmentDescription":string,"lighting":string,"timeOfDay":string,"cameraAngle":string,"cameraMovement":string,"framing":string,"startFrameDescription":string,"endFrameDescription":string,"imagePrompt":string,"videoPrompt":string,"negativePrompt":string,"dialogue":string,"soundEffects":string[],"musicDirection":string}`,
      "",
      `Story: ${refinedStory}`,
    ].join("\n"),
  });

  const parsed = extractJson(text) as SceneDraft[];
  return parsed.slice(0, sceneCount);
}

export async function finalizeStoryAndGenerateScenes(
  projectId: string,
  opts: { sceneCount?: number } = {}
): Promise<SceneJson[]> {
  const sceneCount = Math.min(Math.max(opts.sceneCount ?? 5, 3), 8);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { visualBible: { include: { styleProfile: true } }, story: true },
  });
  if (!project?.story) throw new Error("Project or story not found");

  const visualStyle = project.visualBible?.styleProfile?.renderStyle ?? "cinematic-realistic";
  const llm = getDefaultProvider("llm") as LLMProvider;

  const existingBeatSheet = project.story.beatSheet as BeatSheet | null;
  const { narrative: refinedText, beatSheet } =
    project.story.refinedText && existingBeatSheet
      ? { narrative: project.story.refinedText, beatSheet: existingBeatSheet }
      : await refineStory(project.story.rawInput, visualStyle);

  const entities = await extractEntities(refinedText, llm);

  if (!project.visualBible) throw new Error("Project has no Visual Bible");
  const visualBibleId = project.visualBible.id;

  const nameToCharacterId = new Map<string, string>();
  for (const c of entities.characters) {
    const row = await prisma.character.create({ data: { visualBibleId, name: c.name, description: c.description } });
    nameToCharacterId.set(c.name, row.id);
  }

  const nameToEnvironmentId = new Map<string, string>();
  for (const e of entities.environments) {
    const row = await prisma.environment.create({ data: { visualBibleId, name: e.name, description: e.description } });
    nameToEnvironmentId.set(e.name, row.id);
  }

  for (const p of entities.props) {
    await prisma.prop.create({ data: { visualBibleId, name: p.name, description: p.description } });
  }

  const drafts = await breakdownScenes(refinedText, beatSheet, entities, sceneCount, visualStyle, llm);
  const sceneIds = drafts.map((_, i) => `scene_${i + 1}`);

  const scenes: SceneJson[] = drafts.map((draft, i) => {
    const candidate = {
      sceneId: sceneIds[i],
      index: i,
      duration: draft.durationSeconds || 5,
      storyBeat: draft.storyBeat,
      purpose: draft.purpose,
      characters: draft.characterNames.map((name) => ({
        characterRef: nameToCharacterId.get(name) ?? name,
        action: draft.characterActions?.[name] ?? "",
      })),
      environment: {
        environmentRef: nameToEnvironmentId.get(draft.environmentName),
        description: draft.environmentDescription || draft.environmentName,
        timeOfDay: draft.timeOfDay,
        lighting: draft.lighting,
        props: [],
      },
      camera: {
        angle: draft.cameraAngle,
        movement: draft.cameraMovement,
        framing: draft.framing,
      },
      continuity: {
        previousSceneId: i > 0 ? sceneIds[i - 1] : undefined,
        startFrameDescription: i > 0 ? drafts[i - 1].endFrameDescription : draft.startFrameDescription,
        endFrameDescription: draft.endFrameDescription,
      },
      transition: {
        toNextSceneId: i < drafts.length - 1 ? sceneIds[i + 1] : undefined,
        type: i < drafts.length - 1 ? ("cut" as const) : ("none" as const),
      },
      style: { visualStyle },
      generation: {
        imagePrompt: draft.imagePrompt,
        videoPrompt: draft.videoPrompt,
        negativePrompt: draft.negativePrompt,
      },
      audio: {
        dialogue: draft.dialogue,
        soundEffects: draft.soundEffects ?? [],
        musicDirection: draft.musicDirection,
      },
    };

    return SceneSchema.parse(candidate);
  });

  await prisma.scene.deleteMany({ where: { projectId } });
  for (const scene of scenes) {
    await prisma.scene.create({
      data: { projectId, index: scene.index, sceneJson: scene },
    });
  }

  await prisma.story.update({
    where: { projectId },
    data: { refinedText, beatSheet, finalizedAt: new Date() },
  });

  return scenes;
}
