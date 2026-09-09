import { CLIP_CENTS, MIN_KELLY_CLIP_CENTS, QUARTER_KELLY } from "../config.ts";

/** ¼-Kelly shrink-only under clip. Never expands the clip. */
export function quarterKellyClip(deployableCents: number, score: number): number {
  const edge = Math.max(0, Math.min(1, score));
  const raw = Math.floor(Math.max(0, deployableCents) * edge * QUARTER_KELLY);
  if (raw < MIN_KELLY_CLIP_CENTS) return 0;
  return Math.min(CLIP_CENTS, raw);
}
