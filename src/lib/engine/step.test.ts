import assert from "node:assert/strict";
import test from "node:test";
import type { Candidate, ScanPayload } from "../types.ts";
import { gateCandidate } from "./gates.ts";
import { applyScan, arm, bootDesk } from "./step.ts";

function gem(over: Partial<Candidate> = {}): Candidate {
  return gateCandidate({
    id: over.id ?? "p1",
    symbol: over.symbol ?? "GEM",
    name: "Gem",
    mint: over.mint ?? "mint1",
    pairAddress: "pair1",
    dex: "raydium",
    priceUsd: 0.01,
    change1h: 22,
    change24h: 40,
    liquidityUsd: 80_000,
    volume1h: 12_000,
    buys1h: 80,
    sells1h: 50,
    buyers1h: 40,
    sellers1h: 30,
    pairAgeMin: 40,
    fdvUsd: 100_000,
    decimals: 6,
    imageUrl: null,
    ...over,
  });
}

test("armed hunt takes a $20 seat on a sellable pump", () => {
  const now = Date.UTC(2026, 8, 9, 14, 0, 0);
  const names = ["AA", "BB", "CC"].map((s, i) =>
    gem({ id: s, symbol: s, mint: `m${i}`, change1h: 20 + i }),
  );
  const scan: ScanPayload = {
    asOf: now,
    source: "geckoterminal+kraken",
    stale: false,
    error: null,
    majors: [],
    candidates: names,
  };
  let desk = bootDesk(now);
  desk = applyScan(desk, scan, now);
  assert.equal(desk.book.seats.length, 0);
  desk = arm(desk, now, true);
  desk = applyScan(desk, scan, now + 1);
  assert.equal(desk.book.seats.length > 0, true);
  assert.equal(desk.book.cashCents < 500_000, true);
});
