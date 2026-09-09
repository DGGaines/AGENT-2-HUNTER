import {
  CLIP_CENTS,
  LAUNCH_TIME_STOP_MS,
  LP_COLLAPSE_PCT,
  MAJOR_TIME_STOP_MS,
  PAPER_SEED_CENTS,
  PUMP_TIME_STOP_MS,
  RESERVE_CENTS,
  RUNG_BANK_CENTS,
  RUNG_CENTS,
  SEATS_PER_RUNG,
  SEAT_FLOOR,
  STOP_LOSS_PCT,
  TRAIL_ARM_PCT,
  TRAIL_GIVEBACK_PCT,
} from "../config.ts";
import { paperFill, type FillPort } from "../ports/fill.ts";
import { intelFresh } from "../ports/intel.ts";
import type { Book, Candidate, ExitReason, Fill, Seat } from "../types.ts";
import { canEnter } from "./gates.ts";
import { rid } from "./ids.ts";
import { quarterKellyClip } from "./kelly.ts";
import { clampCents, usdToCents } from "./money.ts";

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
    slipCents: 0,
    taxCents: 0,
    dayStartEquityCents: PAPER_SEED_CENTS,
    dayStamp: utcDayStamp(now),
    peakEquityCents: PAPER_SEED_CENTS,
    rungsTaken: 0,
    paperRungLivePromote: false,
    bankDestination: "paper-hold",
  };
}

export function seatCapacity(book: Book): number {
  return SEAT_FLOOR + book.rungsTaken * SEATS_PER_RUNG;
}

export function markSeats(seats: Seat[], marks: Record<string, number>): number {
  let sum = 0;
  for (const s of seats) {
    const px = marks[s.mint] ?? 0;
    sum += usdToCents(s.qty * px);
  }
  return clampCents(sum);
}

export function equityGross(book: Book, marks: Record<string, number>): number {
  return book.cashCents + book.taxHoldCents + book.bankedCents + markSeats(book.seats, marks);
}

export function equityNet(book: Book, marks: Record<string, number>): number {
  return equityGross(book, marks);
}

/** Deployable = cash minus sacred reserve. Banked is never deployable. */
export function deployableCash(book: Book): number {
  return Math.max(0, book.cashCents - RESERVE_CENTS);
}

export function rungProgress(book: Book): number {
  return book.realizedAfterTaxCents - book.rungsTaken * RUNG_CENTS;
}

export type EnterResult =
  | { ok: true; book: Book; fill: Fill; paperBps: number }
  | { ok: false; book: Book; reason: string };

export function enter(
  book: Book,
  c: Candidate,
  now: number,
  port: FillPort = paperFill,
): EnterResult {
  if (!(c.intelAsOf > 0)) return { ok: false, book, reason: "missing intel" };
  if (!intelFresh(c.intelAsOf, now)) return { ok: false, book, reason: "stale intel" };
  if (!canEnter(c)) return { ok: false, book, reason: `gate ${c.gate}` };
  if (book.seats.length >= seatCapacity(book)) {
    return { ok: false, book, reason: "full" };
  }
  if (book.seats.some((s) => s.mint === c.mint)) {
    return { ok: false, book, reason: "already in seat" };
  }
  const clip = quarterKellyClip(deployableCash(book), c.score);
  if (clip <= 0) return { ok: false, book, reason: "kelly dust" };
  if (clip > deployableCash(book)) return { ok: false, book, reason: "frozen — cannot fund" };
  const lotId = rid("lot");
  const report = port.submit(
    {
      side: "buy",
      symbol: c.symbol,
      mint: c.mint,
      venue: c.venue,
      clipCents: clip,
      markPx: c.priceUsd,
      liquidityUsd: c.liquidityUsd,
      reason: `${c.book} ${c.gateNote}`,
      lotId,
    },
    { now },
  );
  if (!report.ok) return { ok: false, book, reason: report.reason };
  const fill = report.fill;
  const debit = fill.notionalCents + fill.feeCents + fill.slipCents;
  if (debit > deployableCash(book)) {
    return { ok: false, book, reason: "cash after reserve" };
  }
  const strategy = c.book === "NONE" ? "MAJOR" : c.book;
  const seat: Seat = {
    id: rid("s"),
    symbol: c.symbol,
    mint: c.mint,
    pairAddress: c.pairAddress,
    chain: c.chain,
    venue: c.venue,
    cluster: c.cluster,
    deployerId: c.deployerId,
    qty: fill.qty,
    avgPx: fill.px,
    costCents: fill.notionalCents,
    feesPaidCents: fill.feeCents,
    slipPaidCents: fill.slipCents,
    taxPaidCents: 0,
    openedAt: now,
    peakPx: fill.px,
    strategy,
    clipCents: clip,
    reason: fill.reason,
    intel: {
      asOf: c.intelAsOf,
      complete: c.intelComplete,
      social: c.social,
      rug: c.rug,
      sellSim: c.sellSim,
      source: c.venue,
      liquidityUsd: c.liquidityUsd,
    },
    state: "OPEN",
  };
  const next: Book = {
    ...book,
    cashCents: book.cashCents - debit,
    feesCents: book.feesCents + fill.feeCents,
    slipCents: book.slipCents + fill.slipCents,
    seats: [...book.seats, seat],
    fills: [...book.fills, fill],
  };
  return { ok: true, book: next, fill, paperBps: report.paperBps };
}

export type ExitResult =
  | { ok: true; book: Book; fill: Fill; paperBps: number }
  | { ok: false; book: Book; reason: string };

export function exit(
  book: Book,
  seatId: string,
  markPx: number,
  now: number,
  reason: ExitReason,
  liquidityUsd = 0,
  port: FillPort = paperFill,
): ExitResult {
  const seat = book.seats.find((s) => s.id === seatId);
  if (!seat) return { ok: false, book, reason: "no seat" };
  if (!(markPx > 0)) return { ok: false, book, reason: "no mark" };
  const report = port.submit(
    {
      side: "sell",
      symbol: seat.symbol,
      mint: seat.mint,
      venue: seat.venue,
      qty: seat.qty,
      clipCents: seat.clipCents,
      markPx,
      liquidityUsd: liquidityUsd || seat.intel.liquidityUsd,
      reason,
      lotId: seat.id,
      costCents: seat.costCents,
    },
    { now },
  );
  if (!report.ok) return { ok: false, book, reason: report.reason };
  const fill = report.fill;
  const proceeds = Math.max(0, fill.notionalCents - fill.feeCents - fill.slipCents);
  const netToCash = proceeds - fill.taxCents;
  const gain = proceeds - seat.costCents;
  const next: Book = {
    ...book,
    cashCents: book.cashCents + netToCash,
    taxHoldCents: book.taxHoldCents + fill.taxCents,
    feesCents: book.feesCents + fill.feeCents,
    slipCents: book.slipCents + fill.slipCents,
    taxCents: book.taxCents + fill.taxCents,
    realizedCents: book.realizedCents + gain,
    realizedAfterTaxCents: book.realizedAfterTaxCents + (gain - fill.taxCents),
    seats: book.seats.filter((s) => s.id !== seatId),
    fills: [...book.fills, fill],
  };
  return { ok: true, book: applyRungs(next), fill, paperBps: report.paperBps };
}

/** $1k fully-net realized → $500 banked (sacred) + $500 recycled. Never raid bank. Never auto-promote to live. */
export function applyRungs(book: Book): Book {
  const due = Math.floor(book.realizedAfterTaxCents / RUNG_CENTS);
  if (due <= book.rungsTaken) return { ...book, paperRungLivePromote: false };
  let rungs = book.rungsTaken;
  let cash = book.cashCents;
  let banked = book.bankedCents;
  while (rungs < due) {
    const take = Math.min(RUNG_BANK_CENTS, Math.max(0, cash - RESERVE_CENTS));
    cash -= take;
    banked += take;
    rungs += 1;
  }
  return { ...book, cashCents: cash, bankedCents: banked, rungsTaken: rungs, paperRungLivePromote: false };
}

export function rollDay(book: Book, now: number, marks: Record<string, number>): Book {
  const stamp = utcDayStamp(now);
  const eq = equityNet(book, marks);
  const peak = Math.max(book.peakEquityCents, eq);
  if (stamp === book.dayStamp) return { ...book, peakEquityCents: peak };
  return {
    ...book,
    dayStamp: stamp,
    dayStartEquityCents: eq,
    peakEquityCents: peak,
  };
}

export function withPeaks(book: Book, marks: Record<string, number>): Book {
  const seats = book.seats.map((s) => {
    const px = marks[s.mint] ?? s.avgPx;
    return px > s.peakPx ? { ...s, peakPx: px } : s;
  });
  const eq = equityNet({ ...book, seats }, marks);
  return { ...book, seats, peakEquityCents: Math.max(book.peakEquityCents, eq) };
}

export function shouldExit(
  seat: Seat,
  markPx: number,
  now: number,
  stillSellable: boolean,
  next?: Candidate,
): ExitReason | null {
  if (!(markPx > 0)) return null;
  if (next) {
    if (next.rug.flags.includes("AUTHORITY_RISK") && !seat.intel.rug.flags.includes("AUTHORITY_RISK")) {
      return "authority_flip";
    }
    if (next.rug.flags.includes("TAX_TRAP") && !seat.intel.rug.flags.includes("TAX_TRAP")) {
      return "tax_flip";
    }
    if (
      next.rug.flags.includes("LP_PULL") ||
      (seat.intel.liquidityUsd > 0 && next.liquidityUsd < seat.intel.liquidityUsd * LP_COLLAPSE_PCT)
    ) {
      return "lp_flip";
    }
    if (next.rug.hard) return "rug_flip";
  }
  if (!stillSellable) return "sellability_lost";
  const pnl = (markPx - seat.avgPx) / seat.avgPx;
  if (pnl <= -STOP_LOSS_PCT) return "stop";
  const life = now - seat.openedAt;
  const limit =
    seat.strategy === "LAUNCH"
      ? LAUNCH_TIME_STOP_MS
      : seat.strategy === "PUMP"
        ? PUMP_TIME_STOP_MS
        : MAJOR_TIME_STOP_MS;
  if (life >= limit) return "time";
  const peak = Math.max(seat.peakPx, markPx);
  const armed = (peak - seat.avgPx) / seat.avgPx >= TRAIL_ARM_PCT;
  if (armed) {
    const give = (peak - markPx) / peak;
    if (give >= TRAIL_GIVEBACK_PCT) return "trail";
  }
  return null;
}

export function cannotRaidBank(book: Book): boolean {
  return book.bankedCents >= 0 && deployableCash(book) === Math.max(0, book.cashCents - RESERVE_CENTS);
}

export function clipCap(): number {
  return CLIP_CENTS;
}
