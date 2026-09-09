import { REGIME_MIN_NAMES } from "../config.ts";
import type { Candidate, Regime } from "../types.ts";
import { canEnter } from "./gates.ts";

export function detectRegime(candidates: Candidate[]): { regime: Regime; note: string } {
  const pass = candidates.filter(canEnter);
  const launches = pass.filter((c) => c.book === "LAUNCH");
  const pumps = pass.filter((c) => c.book === "PUMP");
  if (launches.length >= REGIME_MIN_NAMES) {
    return {
      regime: "LAUNCH",
      note: `${launches.length} sellable launches`,
    };
  }
  if (pumps.length >= REGIME_MIN_NAMES) {
    return { regime: "PUMP", note: `${pumps.length} sellable 1h pumps` };
  }
  if (pass.length === 0) {
    return { regime: "FLAT", note: "no name passed the sell gate" };
  }
  return {
    regime: "FLAT",
    note: `${pass.length} passed, below regime floor of ${REGIME_MIN_NAMES}`,
  };
}
