import { z } from "zod";

/**
 * Professional story-structure beat sheet produced by the story-refinement
 * step. Modeled on the short-form marketing/trailer arc (not a full
 * screenplay structure): a cold-open hook, fast world/character setup, the
 * conflict that kicks things off, escalation, the peak payoff moment, and a
 * closing beat that leaves the viewer with a hook or call-to-action.
 *
 * The Scene Planner (src/lib/scene/planner.ts) grounds scene breakdown in
 * this structure instead of splitting the story into arbitrary equal beats.
 */
export const BeatSheetSchema = z.object({
  hook: z.string(),
  setup: z.string(),
  incitingIncident: z.string(),
  risingAction: z.string(),
  climax: z.string(),
  resolution: z.string(),
  craftNotes: z.string().optional(),
});

export type BeatSheet = z.infer<typeof BeatSheetSchema>;

export const BEAT_ORDER: (keyof Omit<BeatSheet, "craftNotes">)[] = [
  "hook",
  "setup",
  "incitingIncident",
  "risingAction",
  "climax",
  "resolution",
];

export const BEAT_LABELS: Record<(typeof BEAT_ORDER)[number], string> = {
  hook: "Hook",
  setup: "Setup",
  incitingIncident: "Inciting Incident",
  risingAction: "Rising Action",
  climax: "Climax",
  resolution: "Resolution",
};
