import type { DeskState } from "./engine/step.ts";
import { bootDesk } from "./engine/step.ts";
import {
  defaultHousehold,
  type HouseholdState,
} from "./household/display-port.ts";

const KEY = "agent2.desk.v1";

type Saved = {
  desk: DeskState;
  house: HouseholdState;
  view: "desk" | "house";
};

export function loadSaved(now: number): Saved {
  const fallback: Saved = {
    desk: bootDesk(now),
    house: defaultHousehold(),
    view: "desk",
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    if (!parsed.desk?.book) return fallback;
    return {
      desk: {
        ...bootDesk(now),
        ...parsed.desk,
        tape: parsed.desk.tape?.slice(0, 80) ?? bootDesk(now).tape,
      },
      house: { ...defaultHousehold(), ...parsed.house },
      view: parsed.view === "house" ? "house" : "desk",
    };
  } catch {
    return fallback;
  }
}

export function saveSaved(s: Saved): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota */
  }
}
