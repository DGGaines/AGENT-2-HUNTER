import assert from "node:assert/strict";
import test from "node:test";
import { CLIP_CENTS, PAPER_SEED_CENTS, RESERVE_CENTS, SEAT_FLOOR } from "../config.ts";
import { deployableCash, emptyBook, seatCapacity } from "./book.ts";
import { gem, scanOf } from "./fixtures.ts";
import { evaluateKill } from "./kill.ts";
import { applyScan, arm, bootDesk, snapshot } from "./step.ts";

test("armed hunt takes a clip on a sellable name — even in FLAT (no sideline)", () => {
  const now = Date.UTC(2026, 8, 9, 14, 0, 0);
  const names = [gem({ id: "AA", symbol: "AA", mint: "m0", change1h: 22, intelAsOf: now })];
  const scan = scanOf(names, now);
  let desk = bootDesk(now);
  desk = applyScan(desk, scan, now);
  assert.equal(desk.book.seats.length, 0);
  desk = arm(desk, now, true);
  desk = applyScan(desk, scan, now + 1);
  assert.equal(desk.book.seats.length, 1);
  assert.equal(desk.book.seats[0]!.mint, "m0");
  assert.equal(desk.book.cashCents < PAPER_SEED_CENTS, true);
  assert.ok(desk.book.seats[0]!.clipCents <= CLIP_CENTS);
});

test("no trade on stale intel", () => {
  const now = Date.UTC(2026, 8, 9, 14, 0, 0);
  const names = ["AA", "BB", "CC"].map((s, i) => gem({ id: s, symbol: s, mint: `m${i}`, intelAsOf: now }));
  const scan = scanOf(names, now, { stale: true, error: "down" });
  let desk = arm(bootDesk(now), now, true);
  desk = applyScan(desk, scan, now + 1);
  assert.equal(desk.book.seats.length, 0);
  assert.equal(desk.killRung, "pause_entries");
});

test("MISS when passers exist and seats are empty", () => {
  const now = Date.UTC(2026, 8, 9, 14, 0, 0);
  const names = [gem({ intelAsOf: now })];
  const scan = scanOf(names, now, { stale: true });
  let desk = arm(bootDesk(now), now, true);
  desk = applyScan(desk, scan, now + 1);
  assert.equal(desk.book.seats.length, 0);
  const snap = snapshot(desk, now + 1);
  assert.equal(snap.miss, true);
  assert.ok(desk.chase.length > 0);
  assert.ok(desk.tape.some((t) => t.kind === "MISS"));
  assert.ok(desk.tape.some((t) => t.kind === "CHASE"));
});

test("kill ladder: stale → pause; daily loss → close-only; failed orders → flatten", () => {
  const now = Date.UTC(2026, 8, 9, 14, 0, 0);
  const scan = scanOf([gem({ intelAsOf: now })], now);
  let k = evaluateKill({
    now,
    armed: true,
    lastPass: now,
    startedAt: now,
    scan: { ...scan, stale: true },
    todayPnlPct: 0,
    drawdownPct: 0,
    failedOrders: 0,
    reconcileMismatch: false,
    current: "clear",
  });
  assert.equal(k.rung, "pause_entries");

  k = evaluateKill({
    now,
    armed: true,
    lastPass: now,
    startedAt: now,
    scan,
    todayPnlPct: -0.09,
    drawdownPct: 0,
    failedOrders: 0,
    reconcileMismatch: false,
    current: "clear",
  });
  assert.equal(k.rung, "close_only");

  k = evaluateKill({
    now,
    armed: true,
    lastPass: now,
    startedAt: now,
    scan,
    todayPnlPct: 0,
    drawdownPct: 0.16,
    failedOrders: 0,
    reconcileMismatch: false,
    current: "clear",
  });
  assert.equal(k.rung, "close_only");

  k = evaluateKill({
    now,
    armed: true,
    lastPass: now,
    startedAt: now,
    scan,
    todayPnlPct: 0,
    drawdownPct: 0,
    failedOrders: 5,
    reconcileMismatch: false,
    current: "clear",
  });
  assert.equal(k.rung, "flatten");
});

test("kill flatten+halt empties seats and refuses START climb", () => {
  const now = Date.UTC(2026, 8, 9, 14, 0, 0);
  const names = [gem({ intelAsOf: now })];
  let desk = arm(bootDesk(now), now, true);
  desk = applyScan(desk, scanOf(names, now), now + 1);
  assert.equal(desk.book.seats.length, 1);
  desk = { ...desk, failedOrders: 5 };
  desk = applyScan(desk, scanOf(names, now + 2), now + 2);
  assert.equal(desk.book.seats.length, 0);
  assert.equal(desk.armed, false);
  assert.equal(desk.killRung, "kill");
  const again = arm(desk, now + 3, true);
  assert.equal(again.armed, false);
});

test("seat floor is 15 not a 4-seat ceiling", () => {
  const now = Date.UTC(2026, 8, 9, 14, 0, 0);
  const names = Array.from({ length: 20 }, (_, i) =>
    gem({
      id: `n${i}`,
      symbol: `N${i}`,
      mint: `mint${i}`,
      cluster: `solo${i}`,
      deployerId: `mint${i}`,
      intelAsOf: now,
    }),
  );
  let desk = arm(bootDesk(now), now, true);
  desk = applyScan(desk, scanOf(names, now), now + 1);
  assert.equal(desk.book.seats.length, SEAT_FLOOR);
  assert.ok(desk.book.seats.length > 4);
  assert.equal(snapshot(desk, now + 1).seatCapacity, SEAT_FLOOR);
});

test("STOP is not the kill ladder", () => {
  const now = 1;
  let desk = arm(bootDesk(now), now, true);
  desk = arm(desk, now + 1, false);
  assert.equal(desk.armed, false);
  assert.notEqual(desk.killRung, "kill");
});

test("empty book starts at seed / reserve / 15 floor", () => {
  const b = emptyBook(1);
  assert.equal(b.cashCents, PAPER_SEED_CENTS);
  assert.equal(b.bankedCents, 0);
  assert.equal(b.rungsTaken, 0);
  assert.equal(seatCapacity(b), SEAT_FLOOR);
  assert.equal(deployableCash(b), PAPER_SEED_CENTS - RESERVE_CENTS);
  assert.equal(b.seats.length, 0);
});
