import { HUNT_BUBBLES, MAX_SEATS, PAPER_SEED_CENTS, RESERVE_CENTS, STALE_AFTER_MS } from "../config.ts";
import type {
  Book,
  Candidate,
  EngineSnapshot,
  JailEntry,
  Regime,
  ScanPayload,
  TapeEvent,
} from "../types.ts";
import { canEnter } from "./gates.ts";
import { rid } from "./ids.ts";
import {
  deployableCash,
  emptyBook,
  enter,
  equityGross,
  equityNet,
  exit,
  markSeats,
  rollDay,
  shouldExit,
  withPeaks,
} from "./book.ts";
import { detectRegime } from "./regime.ts";

export type DeskState = {
  book: Book;
  armed: boolean;
  startedAt: number;
  lastPass: number | null;
  lastScan: ScanPayload | null;
  tape: TapeEvent[];
  jail: JailEntry[];
  regime: Regime;
  regimeNote: string;
};

export function bootDesk(now: number): DeskState {
  return {
    book: emptyBook(now),
    armed: false,
    startedAt: now,
    lastPass: null,
    lastScan: null,
    tape: [
      {
        id: "t_boot",
        ts: now,
        kind: "SCAN",
        text: "desk up · paper only · live is dead",
      },
    ],
    jail: [],
    regime: "FLAT",
    regimeNote: "waiting on first pass",
  };
}

function pushTape(tape: TapeEvent[], ev: Omit<TapeEvent, "id">, cap = 80): TapeEvent[] {
  const next = [{ ...ev, id: rid("t") }, ...tape];
  return next.slice(0, cap);
}

function marksFrom(scan: ScanPayload, book: Book): Record<string, number> {
  const marks: Record<string, number> = {};
  for (const c of scan.candidates) marks[c.mint] = c.priceUsd;
  for (const s of book.seats) {
    if (marks[s.mint] == null) marks[s.mint] = s.avgPx;
  }
  return marks;
}

function jailFrom(candidates: Candidate[], prev: JailEntry[], now: number): JailEntry[] {
  const hard = new Set(["NO_SELLS", "HONEYPOT_SHAPE", "THIN_LP", "IMPACT"]);
  const map = new Map(prev.map((j) => [j.mint, j]));
  for (const c of candidates) {
    if (hard.has(c.gate)) {
      const old = map.get(c.mint);
      map.set(c.mint, {
        mint: c.mint,
        symbol: c.symbol,
        reason: c.gate,
        note: c.gateNote,
        since: old?.since ?? now,
      });
    }
  }
  return [...map.values()].slice(0, 24);
}

export function applyScan(state: DeskState, scan: ScanPayload, now: number): DeskState {
  let book = rollDay(state.book, now, marksFrom(scan, state.book));
  const { regime, note } = detectRegime(scan.candidates);
  let tape = state.tape;
  if (regime !== state.regime) {
    tape = pushTape(tape, {
      ts: now,
      kind: "REGIME",
      text: `${state.regime} → ${regime} · ${note}`,
    });
  }
  tape = pushTape(tape, {
    ts: now,
    kind: scan.stale ? "STALE" : "SCAN",
    text: scan.stale
      ? `stale feed${scan.error ? " · " + scan.error : ""}`
      : `pass · ${scan.candidates.filter((c) => c.gate === "PASS").length} sellable · ${scan.candidates.length} seen`,
  });

  const jail = jailFrom(scan.candidates, state.jail, now);
  const byMint = new Map(scan.candidates.map((c) => [c.mint, c]));
  let marks = marksFrom(scan, book);
  book = withPeaks(book, marks);

  for (const seat of [...book.seats]) {
    const c = byMint.get(seat.mint);
    const sellable = c ? canEnter(c) || c.gate === "PASS" : false;
    const px = marks[seat.mint] ?? seat.avgPx;
    const why = shouldExit(seat, px, now, c ? c.gate === "PASS" : sellable);
    if (!why) continue;
    const res = exit(book, seat.id, px, now, why);
    if (res.ok) {
      book = res.book;
      tape = pushTape(tape, {
        ts: now,
        kind: "EXIT",
        text: `sell ${seat.symbol} · ${why} · net ${fmtFill(res.fill.notionalCents - res.fill.feeCents - res.fill.slipCents - res.fill.taxCents)}`,
      });
    } else {
      tape = pushTape(tape, {
        ts: now,
        kind: "REFUSE",
        text: `could not sell ${seat.symbol} · ${res.reason}`,
      });
    }
  }

  marks = marksFrom(scan, book);
  const passers = scan.candidates.filter(canEnter).sort((a, b) => b.change1h - a.change1h);

  if (state.armed && (regime === "LAUNCH" || regime === "PUMP")) {
    for (const c of passers) {
      if (book.seats.length >= MAX_SEATS) break;
      if (book.seats.some((s) => s.mint === c.mint)) continue;
      if (deployableCash(book) <= 0) break;
      const res = enter(book, c, now);
      if (res.ok) {
        book = res.book;
        tape = pushTape(tape, {
          ts: now,
          kind: "ENTER",
          text: `buy ${c.symbol} · $20 clip · ${c.book} · lp $${Math.round(c.liquidityUsd)}`,
        });
      } else {
        tape = pushTape(tape, {
          ts: now,
          kind: "REFUSE",
          text: `no buy ${c.symbol} · ${res.reason}`,
        });
      }
    }
    if (passers.length > 0 && book.seats.length === 0) {
      tape = pushTape(tape, {
        ts: now,
        kind: "MISS",
        text: `hunt regime ${regime} · 0 seats · miss`,
      });
    }
  }

  return {
    ...state,
    book,
    lastPass: now,
    lastScan: scan,
    tape,
    jail,
    regime,
    regimeNote: note,
  };
}

function fmtFill(cents: number): string {
  const n = cents / 100;
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
}

export function snapshot(state: DeskState, now: number): EngineSnapshot {
  const scan = state.lastScan;
  const candidates = scan?.candidates ?? [];
  const marks = scan ? marksFrom(scan, state.book) : {};
  const inSeats = markSeats(state.book.seats, marks);
  const equity = equityNet(state.book, marks);
  const gross = equityGross(state.book, marks);
  const today = equity - state.book.dayStartEquityCents;
  const hunt = candidates
    .filter((c) => c.gate === "PASS")
    .sort((a, b) => b.change1h - a.change1h)
    .slice(0, HUNT_BUBBLES);
  const last = state.lastPass;
  const heartbeat = last == null ? now - state.startedAt : now - last;
  const miss =
    state.armed &&
    (state.regime === "LAUNCH" || state.regime === "PUMP") &&
    state.book.seats.length === 0 &&
    hunt.length > 0;

  return {
    asOf: last ?? state.startedAt,
    tz: "UTC",
    armed: state.armed,
    scanning: scan != null && !scan.stale,
    lastPass: last,
    heartbeatAgeMs: heartbeat,
    stale: last != null && now - last > STALE_AFTER_MS,
    feedError: scan?.error ?? null,
    regime: state.regime,
    regimeNote: state.regimeNote,
    cashCents: state.book.cashCents,
    inSeatsCents: inSeats,
    taxHoldCents: state.book.taxHoldCents,
    bankedCents: state.book.bankedCents,
    allocatedCents:
      state.book.cashCents + state.book.taxHoldCents + state.book.bankedCents + inSeats,
    sweepableCents: Math.max(0, state.book.cashCents - RESERVE_CENTS - (PAPER_SEED_CENTS - RESERVE_CENTS)),
    equityCents: equity,
    equityGrossCents: gross,
    todayPnlCents: today,
    todayPnlPct: state.book.dayStartEquityCents
      ? today / state.book.dayStartEquityCents
      : 0,
    feesCents: state.book.feesCents,
    realizedAfterTaxCents: state.book.realizedAfterTaxCents,
    seats: state.book.seats,
    marks,
    candidates,
    hunt,
    jail: state.jail,
    tape: state.tape,
    majors: scan?.majors ?? [],
    universeCount: candidates.length,
    passCount: candidates.filter((c) => c.gate === "PASS").length,
    miss,
  };
}

export function arm(state: DeskState, now: number, on: boolean): DeskState {
  return {
    ...state,
    armed: on,
    tape: pushTape(state.tape, {
      ts: now,
      kind: "REGIME",
      text: on ? "START · execution armed (paper)" : "STOP · execution idle",
    }),
  };
}
