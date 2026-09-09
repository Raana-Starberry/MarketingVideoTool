/**
 * Visual style options (product spec §3). This is the project-wide style
 * lock: every scene's image/video prompt inherits it (see planner.ts and
 * ARCHITECTURE.md's Consistency Strategy) rather than each scene defining
 * its own look, to prevent style drift across the generated sequence.
 */
export const STYLE_OPTIONS = [
  { value: "realistic", label: "Realistic" },
  { value: "cinematic-realistic", label: "Cinematic Realistic" },
  { value: "3d-animation", label: "3D Animation" },
  { value: "stylized-3d", label: "Stylized 3D" },
  { value: "cartoon", label: "Cartoon" },
  { value: "game-cinematic", label: "Game Cinematic" },
  { value: "mobile-ad", label: "Mobile-Game Advertising" },
  { value: "custom", label: "Custom" },
] as const;

export type StyleValue = (typeof STYLE_OPTIONS)[number]["value"];

export function styleLabel(value: string): string {
  return STYLE_OPTIONS.find((s) => s.value === value)?.label ?? value;
}
