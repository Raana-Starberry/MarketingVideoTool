import { prisma } from "@/lib/db/client";
import { getDefaultProvider } from "@/lib/providers/registry";
import type { LLMProvider } from "@/lib/providers/types";
import { SceneSchema, type SceneJson } from "./schema";

/**
 * Story & Scene Planner (ARCHITECTURE.md §4, §7, §8). Turns a raw/refined
 * story into: (1) Visual Bible entities (characters/environments), and
 * (2) a sequence of Scene JSON records with continuity chained between them.
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

function isMock(llm: LLMProvider) {
  return llm.id === "mock-llm";
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(trimmed);
}

export async function refineStory(rawInput: string, visualStyle: string): Promise<string> {
  const llm = getDefaultProvider("llm") as LLMProvider;

  if (isMock(llm)) {
    return `${rawInput.trim()}\n\n[Refined for a ${visualStyle} game-marketing trailer — heightened stakes, clearer visual beats, and a stronger hook in the opening shot.]`;
  }

  const { text } = await llm.generateText({
    prompt: [
      "You are a creative director refining a game marketing video concept into a punchy, visual short story.",
      `Target visual style: ${visualStyle}.`,
      "Rewrite the concept below into a vivid 3-6 sentence story with a clear beginning, escalation, and a strong final beat suitable for a short marketing trailer. Do not add scene numbers or JSON — plain prose only.",
      "",
      `Concept: ${rawInput}`,
    ].join("\n"),
  });

  return text.trim();
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
  entities: EntitiesDraft,
  sceneCount: number,
  visualStyle: string,
  llm: LLMProvider
): Promise<SceneDraft[]> {
  if (isMock(llm)) {
    const character = entities.characters[0]?.name ?? "Protagonist";
    const environment = entities.environments[0]?.name ?? "Main Setting";
    return Array.from({ length: sceneCount }, (_, i) => ({
      storyBeat: `Beat ${i + 1} of ${sceneCount}`,
      purpose: i === 0 ? "Establish the hero and world" : i === sceneCount - 1 ? "Deliver the payoff/hook" : "Escalate the conflict",
      durationSeconds: 5,
      characterNames: [character],
      characterActions: { [character]: i === 0 ? "enters the scene" : "reacts to escalating danger" },
      environmentName: environment,
      environmentDescription: `${environment}, beat ${i + 1}`,
      lighting: "dramatic, high contrast",
      cameraAngle: i % 2 === 0 ? "low angle" : "eye level",
      cameraMovement: "slow push in",
      framing: "medium shot",
      startFrameDescription: `Scene ${i + 1} opens on ${character} in ${environment}.`,
      endFrameDescription: `Scene ${i + 1} ends with ${character} turning toward the next beat.`,
      imagePrompt: `${visualStyle} key art: ${character} in ${environment}, beat ${i + 1} of the story.`,
      videoPrompt: `${visualStyle} short clip: ${character} in ${environment}, camera slow push in.`,
      soundEffects: [],
    }));
  }

  const { text } = await llm.generateText({
    jsonMode: true,
    prompt: [
      `Break this story into exactly ${sceneCount} sequential scenes for a ${visualStyle} game-marketing video.`,
      "Use only these established characters and environments (by name):",
      `Characters: ${entities.characters.map((c) => c.name).join(", ") || "(none)"}`,
      `Environments: ${entities.environments.map((e) => e.name).join(", ") || "(none)"}`,
      "Each scene must flow from the previous one's ending — describe endFrameDescription so the next scene's action can continue naturally from it.",
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

  const refinedText = project.story.refinedText ?? (await refineStory(project.story.rawInput, visualStyle));
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

  const drafts = await breakdownScenes(refinedText, entities, sceneCount, visualStyle, llm);
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
    data: { refinedText, finalizedAt: new Date() },
  });

  return scenes;
}
