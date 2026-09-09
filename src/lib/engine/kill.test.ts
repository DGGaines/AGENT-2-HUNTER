import assert from "node:assert/strict";
import test from "node:test";
import { gem, scanOf } from "./fixtures.ts";
import { blocksNewEntries, evaluateKill, shouldFlatten } from "./kill.ts";

const now = Date.UTC(2026, 8, 9, 16, 0, 0);
const scan = scanOf([gem({ intelAsOf: now })], now);

test("kill ladder transitions: clear → pause → close-only → flatten", () => {
  const base = {
    now,
    armed: true,
    lastPass: now,
    startedAt: now,
    scan,
    todayPnlPct: 0,
    drawdownPct: 0,
    failedOrders: 0,
    reconcileMismatch: false,
    current: "clear" as const,
  };
  assert.equal(evaluateKill(base).rung, "clear");
  assert.equal(evaluateKill({ ...base, scan: { ...scan, stale: true } }).rung, "pause_entries");
  assert.equal(evaluateKill({ ...base, reconcileMismatch: true }).rung, "pause_entries");
  assert.equal(evaluateKill({ ...base, todayPnlPct: -0.08 }).rung, "close_only");
  assert.equal(evaluateKill({ ...base, drawdownPct: 0.15 }).rung, "close_only");
  assert.equal(evaluateKill({ ...base, failedOrders: 5 }).rung, "flatten");
  assert.equal(evaluateKill({ ...base, lastPass: now - 200_000 }).rung, "flatten");
  assert.equal(blocksNewEntries("pause_entries"), true);
  assert.equal(shouldFlatten("flatten"), true);
  assert.equal(shouldFlatten("clear"), false);
});
