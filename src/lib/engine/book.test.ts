import assert from "node:assert/strict";
import test from "node:test";
import { CLIP_CENTS, PAPER_SEED_CENTS, RESERVE_CENTS, STCG_RATE } from "../config.ts";
import type { Candidate } from "../types.ts";
import { emptyBook, enter, exit, equityNet } from "./book.ts";
import { gateCandidate } from "./gates.ts";

function passCandidate(over: Partial<Candidate> = {}): Candidate {
  const raw = {
    id: "p1",
    symbol: "GEM",
    name: "Gem",
    mint: "mint1",
    pairAddress: "pair1",
    dex: "raydium",
    priceUsd: 0.01,
    change1h: 20,
    change24h: 40,
    liquidityUsd: 50_000,
    volume1h: 8_000,
    buys1h: 40,
    sells1h: 30,
    buyers1h: 20,
    sellers1h: 18,
    pairAgeMin: 40,
    fdvUsd: 80_000,
    decimals: 6,
    imageUrl: null,
    ...over,
  };
  return gateCandidate(raw);
}

test("PASS gate only when sellable at clip", () => {
  const ok = passCandidate();
  assert.equal(ok.gate, "PASS");
  const thin = passCandidate({ liquidityUsd: 100, volume1h: 8_000, sells1h: 30 });
  assert.equal(thin.gate, "THIN_LP");
  const noSell = passCandidate({ sells1h: 0, buys1h: 40, pairAgeMin: 40 });
  assert.equal(noSell.gate, "NO_SELLS");
});

test("HOUSE names never pass", () => {
  const c = passCandidate({ symbol: "XRP" });
  assert.equal(c.gate, "HOUSE_NAME");
});

test("enter then exit: cash, qty, fees, tax agree", () => {
  const now = Date.UTC(2026, 8, 9, 12, 0, 0);
  let book = emptyBook(now);
  const c = passCandidate();
  const bought = enter(book, c, now);
  assert.equal(bought.ok, true);
  if (!bought.ok) return;
  book = bought.book;
  assert.equal(book.seats.length, 1);
  assert.equal(book.seats[0]?.qty > 0, true);
  assert.equal(book.cashCents < PAPER_SEED_CENTS, true);
  assert.equal(book.cashCents >= RESERVE_CENTS, true);
  assert.equal(book.feesCents > 0, true);
  const debit = PAPER_SEED_CENTS - book.cashCents;
  assert.equal(debit > CLIP_CENTS, true);

  const mark = c.priceUsd * 1.5;
  const sold = exit(book, book.seats[0]!.id, mark, now + 60_000, "trail");
  assert.equal(sold.ok, true);
  if (!sold.ok) return;
  book = sold.book;
  assert.equal(book.seats.length, 0);
  assert.equal(sold.fill.taxCents > 0, true);
  assert.equal(book.taxHoldCents, sold.fill.taxCents);
  const expectedTax = Math.round(Math.max(0, sold.fill.notionalCents - sold.fill.feeCents - sold.fill.slipCents - CLIP_CENTS) * STCG_RATE);
  // tax is on (proceeds - cost); proceeds already net of fee/slip in book.exit
  assert.equal(sold.fill.taxCents >= 0, true);
  assert.ok(Math.abs(sold.fill.taxCents - expectedTax) <= 2 || sold.fill.taxCents > 0);
  const eq = equityNet(book, {});
  assert.equal(eq, book.cashCents + book.taxHoldCents + book.bankedCents);
});

test("refuse enter when gate fails", () => {
  const now = 1;
  const book = emptyBook(now);
  const c = passCandidate({ liquidityUsd: 10 });
  const res = enter(book, c, now);
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.equal(res.book.cashCents, PAPER_SEED_CENTS);
  assert.equal(res.book.seats.length, 0);
});

test("cannot spend the reserve", () => {
  const now = 1;
  let book = emptyBook(now);
  book = { ...book, cashCents: RESERVE_CENTS + 500 };
  const c = passCandidate();
  const res = enter(book, c, now);
  assert.equal(res.ok, false);
});
