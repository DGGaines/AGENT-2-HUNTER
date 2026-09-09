import { create } from "zustand";
import { applyScan, arm, bootDesk, snapshot, type DeskState } from "./engine/step.ts";
import type { EngineSnapshot, ScanPayload } from "./types.ts";
import {
  accrueDisplay,
  defaultHousehold,
  deposit,
  setLedgerQty,
  withdraw,
  type HouseholdState,
} from "./household/display-port.ts";
import type { HouseSymbol } from "./config.ts";
import { loadSaved, saveSaved } from "./persist.ts";

type View = "desk" | "house";

type DeskStore = {
  ready: boolean;
  now: number;
  desk: DeskState;
  house: HouseholdState;
  view: View;
  snap: EngineSnapshot;
  hydrate: () => void;
  tickNow: (n: number) => void;
  ingest: (scan: ScanPayload, now: number) => void;
  setArmed: (on: boolean, now: number) => void;
  setView: (v: View) => void;
  save: () => void;
  houseDeposit: (amount: number) => void;
  houseWithdraw: (amount: number) => void;
  houseAccrue: (hours: number) => void;
  setQty: (symbol: HouseSymbol, qty: number) => void;
};

function persist(get: () => DeskStore) {
  const s = get();
  saveSaved({ desk: s.desk, house: s.house, view: s.view });
}

const t0 = Date.now();
const boot = bootDesk(t0);

export const useDesk = create<DeskStore>((set, get) => ({
  ready: false,
  now: t0,
  desk: boot,
  house: defaultHousehold(),
  view: "desk",
  snap: snapshot(boot, t0),
  hydrate: () => {
    const now = Date.now();
    const saved = loadSaved(now);
    set({
      ready: true,
      now,
      desk: saved.desk,
      house: saved.house,
      view: saved.view,
      snap: snapshot(saved.desk, now),
    });
  },
  tickNow: (n) => {
    const s = get();
    set({ now: n, snap: snapshot(s.desk, n) });
  },
  ingest: (scan, now) => {
    const next = applyScan(get().desk, scan, now);
    set({ desk: next, now, snap: snapshot(next, now) });
    persist(get);
  },
  setArmed: (on, now) => {
    let next = arm(get().desk, now, on);
    if (on && next.lastScan) {
      next = applyScan(next, next.lastScan, now);
    }
    set({ desk: next, now, snap: snapshot(next, now) });
    persist(get);
  },
  setView: (v) => {
    set({ view: v });
    persist(get);
  },
  save: () => persist(get),
  houseDeposit: (amount) => {
    set({ house: deposit(get().house, amount) });
    persist(get);
  },
  houseWithdraw: (amount) => {
    set({ house: withdraw(get().house, amount) });
    persist(get);
  },
  houseAccrue: (hours) => {
    set({ house: accrueDisplay(get().house, hours) });
    persist(get);
  },
  setQty: (symbol, qty) => {
    set({ house: setLedgerQty(get().house, symbol, qty) });
    persist(get);
  },
}));
