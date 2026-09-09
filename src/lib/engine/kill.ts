import {
  DAILY_LOSS_CLOSE_PCT,
  DEADMAN_MS,
  DRAWDOWN_CLOSE_PCT,
  FAILED_ORDERS_FLATTEN,
} from "../config.ts";
import type { KillRung, ScanPayload } from "../types.ts";

export type KillInput = {
  now: number;
  armed: boolean;
  lastPass: number | null;
  startedAt: number;
  scan: ScanPayload | null;
  todayPnlPct: number;
  drawdownPct: number;
  failedOrders: number;
  reconcileMismatch: boolean;
  current: KillRung;
};

export function evaluateKill(i: KillInput): { rung: KillRung; note: string } {
  if (i.reconcileMismatch) {
    return { rung: "pause_entries", note: "reconcile mismatch · $0 marks · no new buys" };
  }
  if (i.failedOrders >= FAILED_ORDERS_FLATTEN) {
    return { rung: i.current === "kill" ? "kill" : "flatten", note: `${i.failedOrders} failed orders · flatten+halt` };
  }
  const last = i.lastPass ?? i.startedAt;
  if (i.armed && i.now - last >= DEADMAN_MS) {
    return { rung: i.current === "kill" ? "kill" : "flatten", note: "dead-man · flatten+halt" };
  }
  if (i.todayPnlPct <= -DAILY_LOSS_CLOSE_PCT) {
    return { rung: "close_only", note: `daily loss ${(i.todayPnlPct * 100).toFixed(1)}% ≥ 8%` };
  }
  if (i.drawdownPct >= DRAWDOWN_CLOSE_PCT) {
    return { rung: "close_only", note: `drawdown ${(i.drawdownPct * 100).toFixed(1)}% ≥ 15%` };
  }
  if (!i.scan || i.scan.stale) {
    return { rung: "pause_entries", note: "stale/venue/intel down · no new entries" };
  }
  if (i.current === "kill") return { rung: "kill", note: "killed · START will not climb this ladder" };
  return { rung: "clear", note: "ladder clear" };
}

export function blocksNewEntries(rung: KillRung): boolean {
  return rung !== "clear";
}

export function allowsExits(rung: KillRung): boolean {
  return rung !== "kill";
}

export function shouldFlatten(rung: KillRung): boolean {
  return rung === "flatten" || rung === "kill";
}
