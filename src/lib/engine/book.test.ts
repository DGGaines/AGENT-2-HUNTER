import assert from "node:assert/strict";
import test from "node:test";
import { CLIP_CENTS, PAPER_SEED_CENTS, RESERVE_CENTS, RUNG_BANK_CENTS, SEAT_FLOOR, STCG_RATE } from "../config.ts";
import { liveOrder } from "../ports/fill.ts";
import { applyRungs, deployableCash, emptyBook, enter, exit, equityNet, seatCapacity } from "./book.ts";
import { gem } from "./fixtures.ts";
import { quarterKellyClip } from "./kelly.ts";

test("PASS gate only when sellable at clip", () => {
  const ok = gem();
  assert.equal(ok.gate, "PASS");
  const thin = gem({ liquidityUsd: 100, volume1h: 400, sells1h: 30, pairAgeMin: 200 });
  assert.equal(thin.gate, "THIN_LP");
  assert.notEqual(thin.gate, "DUMP");
  assert.notEqual(thin.gate, "SELL_SIM");
});

test("honeypot shape fires BEFORE generic NO_SELLS", () => {
  const honey = gem({ sells1h: 0, buys1h: 40, pairAgeMin: 40, volume1h: 12_000, liquidityUsd: 80_000 });
  assert.equal(honey.gate, "HONEYPOT_SHAPE");
  const noSells = gem({ sells1h: 1, buys1h: 8, pairAgeMin: 5, volume1h: 12_000 });
  assert.equal(noSells.gate, "NO_SELLS");
});

test("stables are trash — hard refuse", () => {
  const c = gem({
    symbol: "USDT",
    name: "Tether",
    venueKind: "cex",
    chain: "cex",
    venue: "cex",
    liquidityUsd: 50_000_000,
    volume1h: 8_000_000,
  });
  assert.equal(c.gate, "DENYLIST");
});

test("house names may sit when they clear gates", () => {
  const c = gem({
    symbol: "XRP",
    name: "XRP",
    venueKind: "cex",
    chain: "cex",
    venue: "cex",
    liquidityUsd: 50_000_000,
    volume1h: 8_000_000,
    sells1h: 40,
    buys1h: 40,
  });
  assert.equal(c.gate, "PASS");
});

test("enter then exit: cash, qty, fees, tax, lot ledger agree", () => {
  const now = Date.UTC(2026, 8, 9, 12, 0, 0);
  let book = emptyBook(now);
  const c = gem({ intelAsOf: now });
  const bought = enter(book, c, now);
  assert.equal(bought.ok, true);
  if (!bought.ok) return;
  book = bought.book;
  assert.equal(book.seats.length, 1);
  assert.equal(book.seats[0]!.qty > 0, true);
  assert.equal(book.cashCents < PAPER_SEED_CENTS, true);
  assert.equal(book.cashCents >= RESERVE_CENTS, true);
  assert.equal(book.feesCents > 0, true);
  assert.equal(book.slipCents > 0, true);
  assert.equal(bought.fill.lotId.length > 0, true);
  assert.equal(bought.fill.mode, "paper");
  const debit = PAPER_SEED_CENTS - book.cashCents;
  assert.equal(debit > CLIP_CENTS * 0.5, true);
  assert.ok(bought.fill.notionalCents <= CLIP_CENTS);

  const mark = c.priceUsd * 1.5;
  const sold = exit(book, book.seats[0]!.id, mark, now + 60_000, "trail", c.liquidityUsd);
  assert.equal(sold.ok, true);
  if (!sold.ok) return;
  book = sold.book;
  assert.equal(book.seats.length, 0);
  assert.equal(sold.fill.taxCents > 0, true);
  assert.equal(book.taxHoldCents, sold.fill.taxCents);
  assert.equal(sold.fill.taxCents >= 0, true);
  void STCG_RATE;
  const eq = equityNet(book, {});
  assert.equal(eq, book.cashCents + book.taxHoldCents + book.bankedCents);
});

test("refuse enter when gate fails", () => {
  const now = Date.UTC(2026, 8, 9, 12, 0, 0);
  const book = emptyBook(now);
  const c = gem({ liquidityUsd: 10, volume1h: 400, pairAgeMin: 200, intelAsOf: now });
  assert.equal(c.gate, "THIN_LP");
  const res = enter(book, c, now);
  assert.equal(res.ok, false);
  if (res.ok) throw new Error("thin LP must refuse enter");
  assert.equal(res.reason, "gate THIN_LP");
  assert.equal(res.book.cashCents, PAPER_SEED_CENTS);
  assert.equal(res.book.seats.length, 0);
});

test("cannot spend the reserve or raid the bank", () => {
  const now = Date.UTC(2026, 8, 9, 12, 0, 0);
  let book = emptyBook(now);
  book = { ...book, cashCents: RESERVE_CENTS + 500, bankedCents: 80_000 };
  const c = gem({ intelAsOf: now });
  assert.equal(c.gate, "PASS");
  const res = enter(book, c, now);
  assert.equal(res.ok, false);
  if (res.ok) throw new Error("reserve must block enter");
  assert.match(res.reason, /kelly dust|frozen|cash after reserve/);
  assert.equal(book.bankedCents, 80_000);
  assert.equal(res.book.bankedCents, 80_000);
  assert.equal(deployableCash(book), 500);
});

test("rung banks $500 and recycles $500; +2 seats; not live-promotable", () => {
  const now = 1;
  let book = emptyBook(now);
  book = {
    ...book,
    cashCents: PAPER_SEED_CENTS + 100_000,
    realizedAfterTaxCents: 100_000,
  };
  book = applyRungs(book);
  assert.equal(book.rungsTaken, 1);
  assert.equal(book.bankedCents, RUNG_BANK_CENTS);
  assert.equal(book.cashCents, PAPER_SEED_CENTS + 50_000);
  assert.equal(book.paperRungLivePromote, false);
  assert.equal(seatCapacity(book), SEAT_FLOOR + 2);
});

test("freeze new entries when underfunded — do not flatten to 15", () => {
  const now = Date.UTC(2026, 8, 9, 12, 0, 0);
  let book = emptyBook(now);
  const seats = Array.from({ length: 16 }, (_, i) => ({
    ...emptyBook(now).seats[0],
    id: `s${i}`,
    symbol: `S${i}`,
    mint: `m${i}`,
    pairAddress: `p${i}`,
    chain: "solana",
    venue: "gt:solana",
    cluster: i < 4 ? "meme-dog" : `c${i}`,
    deployerId: `m${i}`,
    qty: 1,
    avgPx: 1,
    costCents: 100,
    feesPaidCents: 0,
    slipPaidCents: 0,
    taxPaidCents: 0,
    openedAt: now,
    peakPx: 1,
    strategy: "PUMP" as const,
    clipCents: CLIP_CENTS,
    reason: "seed",
    intel: gem().sellSim
      ? {
          asOf: now,
          complete: true,
          social: gem().social,
          rug: gem().rug,
          sellSim: gem().sellSim,
          source: "t",
          liquidityUsd: 80_000,
        }
      : {
          asOf: now,
          complete: true,
          social: "ORGANIC" as const,
          rug: { hard: false, flags: [], note: "clean" },
          sellSim: { canExit: true, impact: 0.01, depthUsd: 80_000, clipUsd: 250, note: "ok" },
          source: "t",
          liquidityUsd: 80_000,
        },
    state: "OPEN" as const,
  }));
  book = {
    ...book,
    rungsTaken: 1,
    cashCents: RESERVE_CENTS + 800,
    seats,
  };
  assert.equal(seatCapacity(book), 17);
  assert.equal(book.seats.length, 16);
  const res = enter(book, gem({ mint: "fresh", id: "fresh", symbol: "NEW", intelAsOf: now }), now);
  assert.equal(res.ok, false);
  if (res.ok) throw new Error("underfunded book must refuse a new seat");
  assert.match(res.reason, /kelly dust|frozen|cash after reserve/);
  assert.notEqual(res.reason, "full");
  assert.equal(res.book.seats.length, 16);
  assert.ok(res.book.seats.length > SEAT_FLOOR);
});

test("¼-Kelly shrinks under clip and never expands it", () => {
  assert.equal(quarterKellyClip(4_500_00, 0.9), CLIP_CENTS);
  assert.ok(quarterKellyClip(20_000, 0.2) < CLIP_CENTS);
  assert.equal(quarterKellyClip(500, 0.9), 0);
});

test("LiveOrder stub never fills", () => {
  const r = liveOrder.submit(
    {
      side: "buy",
      symbol: "X",
      mint: "m",
      venue: "x",
      clipCents: CLIP_CENTS,
      markPx: 1,
      liquidityUsd: 1_000_000,
      reason: "t",
      lotId: "l",
    },
    { now: 1 },
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.reason, "LIVE_DEAD");
});
