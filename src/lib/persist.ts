import type { DeskState } from "./engine/step.ts";
import { bootDesk } from "./engine/step.ts";
import { defaultHousehold, type HouseholdState } from "./household/display-port.ts";

const KEY = "agent2.desk.v2";

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
    const boot = bootDesk(now);
    return {
      desk: {
        ...boot,
        ...parsed.desk,
        liveArmed: false,
        tape: parsed.desk.tape?.slice(0, 120) ?? boot.tape,
        book: {
          ...boot.book,
          ...parsed.desk.book,
          paperRungLivePromote: false,
        },
      },
      house: { ...defaultHousehold(), ...parsed.house, ledger: parsed.house?.ledger?.length ? parsed.house.ledger : defaultHousehold().ledger },
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
