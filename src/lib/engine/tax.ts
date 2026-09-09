import { STCG_RATE } from "../config.ts";
import { clampCents } from "./money.ts";

/** Withhold STCG on a realized gain. Losses withhold 0. Never a negative tax. */
export function withholdStcg(gainCents: number): number {
  if (gainCents <= 0) return 0;
  return clampCents(gainCents * STCG_RATE);
}
