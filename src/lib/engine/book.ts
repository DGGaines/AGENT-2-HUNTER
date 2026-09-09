import {
  CLIP_CENTS,
  LAUNCH_TIME_STOP_MS,
  MAX_SEATS,
  PAPER_SEED_CENTS,
  PUMP_TIME_STOP_MS,
  RESERVE_CENTS,
  RUNG_CENTS,
  SLIP_BPS,
  STOP_LOSS_PCT,
  TAKER_FEE_BPS,
  TRAIL_ARM_PCT,
  TRAIL_GIVEBACK_PCT,
} from "../config.ts";
import type { Book, Candidate, Fill, Seat } from "../types.ts";
import { canEnter } from "./gates.ts";
import { rid } from "./ids.ts";
import { applyBps, clampCents, usdToCents } from "./money.ts";
import { withholdStcg } from "./tax.ts";

export function utcDayStamp(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function emptyBook(now: number): Book {
  return {
    cashCents: PAPER_SEED_CENTS,
    taxHoldCents: 0,
    bankedCents: 0,
    seats: [],
    fills: [],
    realizedCents: 0,
    realizedAfterTaxCents: 0,
    feesCents: 0,
    dayStartEquityCents: PAPER_SEED_CENTS,
    dayStamp: utcDayStamp(now),
  };
}

export function markSeats(seats: Seat[], marks: Record<string, number>): number {
  let sum = 0;
  for (const s of seats) {
    const px = marks[s.mint] ?? s.avgPx;
    sum += usdToCents(s.qty * px);
  }
  return clampCents(sum);
}

export function equityGross(book: Book, marks: Record<string, number>): number {
  return (
    book.cashCents +
    book.taxHoldCents +
    book.bankedCents +
    markSeats(book.seats, marks)
  );
}

export function equityNet(book: Book, marks: Record<string, number>): number {
  // taxHold is already withheld from cash; net == gross of remaining balances.
  return equityGross(book, marks);
}

export function deployableCash(book: Book): number {
  const locked = RESERVE_CENTS;
  return Math.max(0, book.cashCents - locked);
}

function costsOn(notional: number): { fee: number; slip: number; debit: number } {
  const fee = applyBps(notional, TAKER_FEE_BPS);
  const slip = applyBps(notional, SLIP_BPS);
  return { fee, slip, debit: notional + fee + slip };
}

export type EnterResult =
  | { ok: true; book: Book; fill: Fill }
  | { ok: false; book: Book; reason: string };

export function enter(
  book: Book,
  c: Candidate,
  now: number,
): EnterResult {
  if (!canEnter(c) || c.book === "NONE") {
    return { ok: false, book, reason: `gate ${c.gate}` };
  }
  if (book.seats.length >= MAX_SEATS) {
    return { ok: false, book, reason: "max seats" };
  }
  if (book.seats.some((s) => s.mint === c.mint)) {
    return { ok: false, book, reason: "already in seat" };
  }
  const clip = CLIP_CENTS;
  const { fee, slip, debit } = costsOn(clip);
  if (debit > deployableCash(book)) {
    return { ok: false, book, reason: "cash after reserve" };
  }
  const px = c.priceUsd * (1 + SLIP_BPS / 10_000);
  if (!(px > 0)) return { ok: false, book, reason: "no px" };
  const qty = clip / 100 / px;
  const fill: Fill = {
    id: rid("f"),
    ts: now,
    side: "buy",
    symbol: c.symbol,
    mint: c.mint,
    qty,
    px,
    notionalCents: clip,
    feeCents: fee,
    slipCents: slip,
    taxCents: 0,
    liquidity: "taker",
    reason: `${c.book} ${c.gateNote}`,
  };
  const seat: Seat = {
    id: rid("s"),
    symbol: c.symbol,
    mint: c.mint,
    pairAddress: c.pairAddress,
    qty,
    avgPx: px,
    costCents: clip,
    feesPaidCents: fee + slip,
    openedAt: now,
    peakPx: px,
    strategy: c.book,
    clipCents: clip,
  };
  const next: Book = {
    ...book,
    cashCents: book.cashCents - debit,
    feesCents: book.feesCents + fee + slip,
    seats: [...book.seats, seat],
    fills: [...book.fills, fill],
  };
  return { ok: true, book: next, fill };
}

export type ExitReason = "stop" | "trail" | "time" | "gate_flip" | "flatten" | "manual";

export type ExitResult =
  | { ok: true; book: Book; fill: Fill }
  | { ok: false; book: Book; reason: string };

export function exit(
  book: Book,
  seatId: string,
  markPx: number,
  now: number,
  reason: ExitReason,
): ExitResult {
  const seat = book.seats.find((s) => s.id === seatId);
  if (!seat) return { ok: false, book, reason: "no seat" };
  if (!(markPx > 0)) return { ok: false, book, reason: "no mark" };
  const px = markPx * (1 - SLIP_BPS / 10_000);
  const notional = usdToCents(seat.qty * px);
  const { fee, slip } = costsOn(notional);
  const proceeds = Math.max(0, notional - fee - slip);
  const gain = proceeds - seat.costCents;
  const tax = withholdStcg(gain);
  const netToCash = proceeds - tax;
  const fill: Fill = {
    id: rid("f"),
    ts: now,
    side: "sell",
    symbol: seat.symbol,
    mint: seat.mint,
    qty: seat.qty,
    px,
    notionalCents: notional,
    feeCents: fee,
    slipCents: slip,
    taxCents: tax,
    liquidity: "taker",
    reason,
  };
  const next: Book = {
    ...book,
    cashCents: book.cashCents + netToCash,
    taxHoldCents: book.taxHoldCents + tax,
    feesCents: book.feesCents + fee + slip,
    realizedCents: book.realizedCents + gain,
    realizedAfterTaxCents: book.realizedAfterTaxCents + (gain - tax),
    seats: book.seats.filter((s) => s.id !== seatId),
    fills: [...book.fills, fill],
  };
  return { ok: true, book: sweepRungs(next), fill };
}

function sweepRungs(book: Book): Book {
  let cash = book.cashCents;
  let banked = book.bankedCents;
  const deployable = Math.max(0, cash - RESERVE_CENTS);
  const extra = Math.max(0, deployable - (PAPER_SEED_CENTS - RESERVE_CENTS));
  const rungs = Math.floor(extra / RUNG_CENTS);
  if (rungs <= 0) return book;
  const move = rungs * RUNG_CENTS;
  cash -= move;
  banked += move;
  return { ...book, cashCents: cash, bankedCents: banked };
}

export function rollDay(book: Book, now: number, marks: Record<string, number>): Book {
  const stamp = utcDayStamp(now);
  if (stamp === book.dayStamp) return book;
  return {
    ...book,
    dayStamp: stamp,
    dayStartEquityCents: equityNet(book, marks),
  };
}

export function withPeaks(book: Book, marks: Record<string, number>): Book {
  const seats = book.seats.map((s) => {
    const px = marks[s.mint] ?? s.avgPx;
    return px > s.peakPx ? { ...s, peakPx: px } : s;
  });
  return { ...book, seats };
}

export function shouldExit(
  seat: Seat,
  markPx: number,
  now: number,
  stillSellable: boolean,
): ExitReason | null {
  if (!(markPx > 0)) return null;
  if (!stillSellable) return "gate_flip";
  const pnl = (markPx - seat.avgPx) / seat.avgPx;
  if (pnl <= -STOP_LOSS_PCT) return "stop";
  const life = now - seat.openedAt;
  const limit = seat.strategy === "LAUNCH" ? LAUNCH_TIME_STOP_MS : PUMP_TIME_STOP_MS;
  if (life >= limit) return "time";
  const peak = Math.max(seat.peakPx, markPx);
  const armed = (peak - seat.avgPx) / seat.avgPx >= TRAIL_ARM_PCT;
  if (armed) {
    const give = (peak - markPx) / peak;
    if (give >= TRAIL_GIVEBACK_PCT) return "trail";
  }
  return null;
}
