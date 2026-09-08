import { z } from "zod";

/**
 * The Scene JSON schema — the single source of truth for a scene's content.
 * See ARCHITECTURE.md §4. Every provider request is built by projecting this
 * (plus the Visual Bible and continuity context) into that provider's shape.
 */

export const SceneCharacterSchema = z.object({
  characterRef: z.string(), // id into VisualBible.characters
  appearanceOverride: z.string().optional(),
  clothingRef: z.string().optional(),
  position: z.string().optional(),
  action: z.string(),
  facialExpression: z.string().optional(),
  dialogue: z
    .object({
      text: z.string(),
      emotion: z.string().optional(),
      language: z.string().optional(),
    })
    .optional(),
});

export const SceneEnvironmentSchema = z.object({
  environmentRef: z.string().optional(),
  description: z.string(),
  background: z.string().optional(),
  props: z.array(z.string()).default([]),
  timeOfDay: z.string().optional(),
  lighting: z.string(),
});

export const SceneCameraSchema = z.object({
  angle: z.string().optional(),
  lens: z.string().optional(),
  position: z.string().optional(),
  movement: z.string().optional(),
  framing: z.string().optional(),
  composition: z.string().optional(),
  depthOfField: z.string().optional(),
});

export const SceneActionSchema = z.object({
  characterMovement: z.string().optional(),
  environmentalMovement: z.string().optional(),
  physics: z.string().optional(),
});

export const SceneContinuitySchema = z.object({
  previousSceneId: z.string().optional(),
  startFrameDescription: z.string(),
  endFrameDescription: z.string(),
  matchCut: z.boolean().optional(),
  eyeline: z.string().optional(),
  cameraDirection: z.string().optional(),
});

export const SceneTransitionSchema = z.object({
  toNextSceneId: z.string().optional(),
  type: z.enum(["cut", "match-cut", "dissolve", "wipe", "none"]).optional(),
});

export const SceneStyleSchema = z.object({
  visualStyle: z.string(),
  colorPalette: z.array(z.string()).optional(),
});

export const SceneGenerationSchema = z.object({
  imagePrompt: z.string(),
  videoPrompt: z.string(),
  negativePrompt: z.string().optional(),
});

export const SceneAudioSchema = z.object({
  dialogue: z.string().optional(),
  soundEffects: z.array(z.string()).default([]),
  musicDirection: z.string().optional(),
});

export const SceneCaptionSchema = z.object({
  text: z.string().optional(),
  timingHint: z.string().optional(),
});

export const SceneSchema = z.object({
  sceneId: z.string(),
  index: z.number().int().nonnegative(),
  duration: z.number().positive(),
  storyBeat: z.string(),
  purpose: z.string(),

  characters: z.array(SceneCharacterSchema).default([]),
  environment: SceneEnvironmentSchema,
  camera: SceneCameraSchema.default({}),
  action: SceneActionSchema.default({}),
  continuity: SceneContinuitySchema,
  transition: SceneTransitionSchema.default({}),
  style: SceneStyleSchema,
  generation: SceneGenerationSchema,
  audio: SceneAudioSchema.default({ soundEffects: [] }),
  caption: SceneCaptionSchema.optional(),
});

export type SceneJson = z.infer<typeof SceneSchema>;

export function parseSceneJson(input: unknown): SceneJson {
  return SceneSchema.parse(input);
}
