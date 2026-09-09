import {
  DEPLOYER_JAIL_TTL_MS,
  HUNT_BUBBLES,
  JAIL_TTL_MS,
  PAPER_SEED_CENTS,
  RESERVE_CENTS,
  REVENGE_TTL_MS,
  RUNG_CENTS,
  SEAT_FLOOR,
  STALE_AFTER_MS,
} from "../config.ts";
import { paperFill, type FillPort } from "../ports/fill.ts";
import { intelFresh } from "../ports/intel.ts";
import type {
  BankDestination,
  Book,
  Candidate,
  ChaseChip,
  DecisionRecord,
  EngineSnapshot,
  JailEntry,
  KillRung,
  Regime,
  ScanPayload,
  SlipSample,
  TapeEvent,
} from "../types.ts";
import {
  applyRungs,
  deployableCash,
  emptyBook,
  enter,
  equityGross,
  equityNet,
  exit,
  markSeats,
  rollDay,
  rungProgress,
  seatCapacity,
  shouldExit,
  withPeaks,
} from "./book.ts";
import { clusterOpen } from "./cluster.ts";
import { canEnter } from "./gates.ts";
import { rid } from "./ids.ts";
import { allowsExits, blocksNewEntries, evaluateKill, shouldFlatten } from "./kill.ts";
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
  killRung: KillRung;
  killNote: string;
  failedOrders: number;
  chase: ChaseChip[];
  decisions: DecisionRecord[];
  slips: SlipSample[];
  liveArmed: false;
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
        why: "one engine · PaperFill · LiveOrder stub",
      },
    ],
    jail: [],
    regime: "FLAT",
    regimeNote: "waiting on first pass",
    killRung: "clear",
    killNote: "ladder clear",
    failedOrders: 0,
    chase: [],
    decisions: [],
    slips: [],
    liveArmed: false,
  };
}

function pushTape(tape: TapeEvent[], ev: Omit<TapeEvent, "id">, cap = 120): TapeEvent[] {
  return [{ ...ev, id: rid("t") }, ...tape].slice(0, cap);
}

function marksFrom(scan: ScanPayload | null, book: Book, zeroMissing: boolean): Record<string, number> {
  const marks: Record<string, number> = {};
  if (scan) {
    for (const c of scan.candidates) marks[c.mint] = c.priceUsd;
    for (const m of scan.majors) marks[m.symbol] = m.priceUsd;
  }
  for (const s of book.seats) {
    if (marks[s.mint] == null) marks[s.mint] = zeroMissing ? 0 : s.avgPx;
  }
  return marks;
}

function pruneJail(prev: JailEntry[], now: number): JailEntry[] {
  return prev.filter((j) => j.until > now);
}

function jailHard(candidates: Candidate[], prev: JailEntry[], now: number): JailEntry[] {
  const hard = new Set(["NO_SELLS", "HONEYPOT_SHAPE", "THIN_LP", "IMPACT", "SELL_SIM", "RUG", "DUMP", "BUNDLE", "DENYLIST", "WASH"]);
  const map = new Map(pruneJail(prev, now).map((j) => [j.mint, j]));
  for (const c of candidates) {
    if (hard.has(c.gate)) {
      const old = map.get(c.mint);
      map.set(c.mint, {
        mint: c.mint,
        symbol: c.symbol,
        reason: c.gate,
        note: c.gateNote,
        evidence: `${c.gate} · ${c.rug.note} · ${c.sellSim.note}`,
        since: old?.since ?? now,
        until: old?.until ?? now + JAIL_TTL_MS,
        deployerId: c.deployerId,
      });
    }
  }
  return [...map.values()].slice(0, 48);
}

function jailed(jail: JailEntry[], mint: string, deployerId: string, now: number): boolean {
  return jail.some((j) => j.until > now && (j.mint === mint || j.deployerId === deployerId));
}

function markDecisions(prev: DecisionRecord[], scan: ScanPayload, now: number): DecisionRecord[] {
  return prev.map((d) => {
    if (d.post) return d;
    const c = scan.candidates.find((x) => x.mint === d.mint);
    if (!c) return d;
    if (d.verdict === "PASS" && (c.gate !== "PASS" || c.rug.hard)) {
      return { ...d, post: "FALSE_PASS", postNote: `${c.gate} after pass · ${c.gateNote}` };
    }
    if (d.verdict === "REFUSE" && c.gate === "PASS" && c.change1h >= 12) {
      return { ...d, post: "FALSE_REFUSE", postNote: `ran +${c.change1h.toFixed(1)}% after refuse` };
    }
    if (now - d.ts > 30 * 60_000) {
      return { ...d, post: "CONFIRMED" };
    }
    return d;
  });
}

export function applyScan(state: DeskState, scan: ScanPayload, now: number, port: FillPort = paperFill): DeskState {
  const mismatch = Boolean(
    scan &&
      state.book.seats.some((s) => !scan.candidates.some((c) => c.mint === s.mint) && !scan.majors.some((m) => m.symbol === s.symbol)),
  );
  let book = rollDay(state.book, now, marksFrom(scan, state.book, mismatch));
  book = applyRungs(book);
  const { regime, note } = detectRegime(scan.candidates);
  let tape = state.tape;
  if (regime !== state.regime) {
    tape = pushTape(tape, { ts: now, kind: "REGIME", text: `${state.regime} → ${regime} · ${note}`, why: note });
  }
  tape = pushTape(tape, {
    ts: now,
    kind: scan.stale ? "STALE" : "SCAN",
    text: scan.stale
      ? `stale feed${scan.error ? " · " + scan.error : ""}`
      : `pass · ${scan.candidates.filter((c) => c.gate === "PASS").length} sellable · ${scan.candidates.length} seen`,
    why: scan.source,
  });

  let jail = jailHard(scan.candidates, state.jail, now);
  const byMint = new Map(scan.candidates.map((c) => [c.mint, c]));
  let marks = marksFrom(scan, book, mismatch);
  book = withPeaks(book, marks);

  const eq = equityNet(book, marks);
  const todayPct = book.dayStartEquityCents ? (eq - book.dayStartEquityCents) / book.dayStartEquityCents : 0;
  const dd = book.peakEquityCents > 0 ? Math.max(0, (book.peakEquityCents - eq) / book.peakEquityCents) : 0;

  const kill = evaluateKill({
    now,
    armed: state.armed,
    lastPass: state.lastPass,
    startedAt: state.startedAt,
    scan,
    todayPnlPct: todayPct,
    drawdownPct: dd,
    failedOrders: state.failedOrders,
    reconcileMismatch: mismatch,
    current: state.killRung,
  });
  if (kill.rung !== state.killRung) {
    tape = pushTape(tape, { ts: now, kind: "KILL", text: `${kill.rung} · ${kill.note}`, why: kill.note });
  }

  let failedOrders = state.failedOrders;
  let slips = state.slips;
  let decisions = markDecisions(state.decisions, scan, now);
  let chase = state.chase.filter((ch) => now - ch.since < 30 * 60_000);

  if (allowsExits(kill.rung) || shouldFlatten(kill.rung)) {
    for (const seat of [...book.seats]) {
      const c = byMint.get(seat.mint);
      const px = mismatch ? 0 : (marks[seat.mint] ?? 0);
      if (mismatch) marks[seat.mint] = 0;
      const sellable = c ? canEnter(c) || (c.gate === "PASS" && c.sellSim.canExit) : false;
      const why = shouldFlatten(kill.rung)
        ? kill.rung === "kill"
          ? "kill_close"
          : "flatten"
        : shouldExit(seat, px || seat.avgPx, now, c ? c.sellSim.canExit || sellable : false, c);
      if (!why) continue;
      const mark = px > 0 ? px : seat.avgPx;
      const res = exit(book, seat.id, mark, now, why, c?.liquidityUsd ?? seat.intel.liquidityUsd, port);
      if (res.ok) {
        book = res.book;
        slips = [{ ts: now, symbol: seat.symbol, side: "sell" as const, paperBps: res.paperBps, liveBps: null }, ...slips].slice(0, 40);
        tape = pushTape(tape, {
          ts: now,
          kind: "EXIT",
          text: `sell ${seat.symbol} · ${why}`,
          why,
        });
        if (why === "authority_flip" || why === "lp_flip" || why === "tax_flip" || why === "rug_flip") {
          jail = [
            {
              mint: seat.mint,
              symbol: seat.symbol,
              reason: "deployer",
              note: why,
              evidence: c ? `${c.rug.note} · lp ${c.liquidityUsd}` : why,
              since: now,
              until: now + DEPLOYER_JAIL_TTL_MS,
              deployerId: seat.deployerId,
            },
            ...jail.filter((j) => j.mint !== seat.mint),
          ];
        }
        if (res.fill.notionalCents - res.fill.feeCents - res.fill.slipCents < seat.costCents) {
          jail = [
            {
              mint: seat.mint,
              symbol: seat.symbol,
              reason: "revenge",
              note: "loss · no revenge",
              evidence: `exit ${why}`,
              since: now,
              until: now + REVENGE_TTL_MS,
              deployerId: seat.deployerId,
            },
            ...jail.filter((j) => !(j.mint === seat.mint && j.reason === "revenge")),
          ];
        }
      } else {
        failedOrders += 1;
        tape = pushTape(tape, { ts: now, kind: "REFUSE", text: `could not sell ${seat.symbol} · ${res.reason}`, why: res.reason });
      }
    }
  }

  marks = marksFrom(scan, book, mismatch);
  const passers = scan.candidates
    .filter(canEnter)
    .filter((c) => c.intelAsOf > 0 && intelFresh(c.intelAsOf, now))
    .sort((a, b) => {
      const ac = chase.some((ch) => ch.mint === a.mint) ? 1 : 0;
      const bc = chase.some((ch) => ch.mint === b.mint) ? 1 : 0;
      return bc - ac || b.score - a.score || b.change1h - a.change1h;
    });

  const frozen =
    blocksNewEntries(kill.rung) ||
    scan.stale ||
    mismatch ||
    !state.armed ||
    deployableCash(book) <= 0;

  if (state.armed && !scan.stale && !blocksNewEntries(kill.rung) && !mismatch && !shouldFlatten(kill.rung)) {
    for (const c of passers) {
      if (book.seats.length >= seatCapacity(book)) break;
      if (book.seats.some((s) => s.mint === c.mint)) continue;
      if (jailed(jail, c.mint, c.deployerId, now)) {
        tape = pushTape(tape, { ts: now, kind: "REFUSE", text: `no buy ${c.symbol} · jail`, why: "jail/revenge/deployer" });
        continue;
      }
      if (!clusterOpen(book.seats, c)) {
        tape = pushTape(tape, {
          ts: now,
          kind: "REFUSE",
          text: `no buy ${c.symbol} · cluster ${c.cluster} cap`,
          why: "cluster/correlation seat cap",
        });
        decisions = [
          {
            id: rid("d"),
            ts: now,
            mint: c.mint,
            symbol: c.symbol,
            verdict: "REFUSE" as const,
            gate: c.gate,
            note: `cluster ${c.cluster}`,
            confidence: c.score,
            strength: c.sellSim.depthUsd,
          },
          ...decisions,
        ].slice(0, 80);
        continue;
      }
      if (deployableCash(book) <= 0) break;
      const res = enter(book, c, now, port);
      if (res.ok) {
        book = res.book;
        slips = [{ ts: now, symbol: c.symbol, side: "buy" as const, paperBps: res.paperBps, liveBps: null }, ...slips].slice(0, 40);
        decisions = [
          {
            id: rid("d"),
            ts: now,
            mint: c.mint,
            symbol: c.symbol,
            verdict: "PASS" as const,
            gate: c.gate,
            note: c.gateNote,
            confidence: c.score,
            strength: c.sellSim.depthUsd * c.score,
          },
          ...decisions,
        ].slice(0, 80);
        tape = pushTape(tape, {
          ts: now,
          kind: "ENTER",
          text: `buy ${c.symbol} · $${(res.fill.notionalCents / 100).toFixed(0)} · ${c.book} · ${c.venue}`,
          why: `${c.gateNote} · ${c.social} · ${c.sellSim.note}`,
        });
        chase = chase.filter((ch) => ch.mint !== c.mint);
      } else if (res.reason.startsWith("frozen") || res.reason === "cash after reserve" || res.reason === "kelly dust") {
        failedOrders += res.reason === "kelly dust" ? 0 : 0;
        break;
      } else {
        failedOrders += 1;
        tape = pushTape(tape, { ts: now, kind: "REFUSE", text: `no buy ${c.symbol} · ${res.reason}`, why: res.reason });
      }
    }
  } else if (state.armed && passers.length) {
    for (const c of passers.slice(0, 8)) {
      decisions = [
        {
          id: rid("d"),
          ts: now,
          mint: c.mint,
          symbol: c.symbol,
          verdict: "REFUSE" as const,
          gate: c.gate,
          note: frozen ? "frozen/stale/kill — no new entries" : "idle",
          confidence: c.score,
          strength: c.sellSim.depthUsd,
        },
        ...decisions,
      ].slice(0, 80);
    }
  }

  const empty = book.seats.length === 0;
  if (state.armed && passers.length > 0 && empty) {
    tape = pushTape(tape, {
      ts: now,
      kind: "MISS",
      text: `MISS · ${passers.length} passers · empty seats`,
      why: scan.stale ? "stale intel" : kill.note,
    });
    for (const c of passers.slice(0, 12)) {
      const chip: ChaseChip = {
        mint: c.mint,
        symbol: c.symbol,
        why: scan.stale || blocksNewEntries(kill.rung) ? "FROZEN" : "MISS",
        since: now,
        change1h: c.change1h,
        gate: c.gate,
      };
      chase = [chip, ...chase.filter((x) => x.mint !== c.mint)];
      tape = pushTape(tape, { ts: now, kind: "CHASE", text: `CHASE ${c.symbol}`, why: chip.why });
    }
  } else if (state.armed && passers.length > 0 && book.seats.length >= seatCapacity(book)) {
    for (const c of passers.filter((p) => !book.seats.some((s) => s.mint === p.mint)).slice(0, 8)) {
      chase = [{ mint: c.mint, symbol: c.symbol, why: "FULL", since: now, change1h: c.change1h, gate: c.gate }, ...chase.filter((x) => x.mint !== c.mint)];
    }
  }

  let armed = state.armed;
  let killRung = kill.rung;
  let killNote = kill.note;
  if (shouldFlatten(kill.rung) && book.seats.length === 0) {
    armed = false;
    killRung = "kill";
    killNote = "flatten+halt";
    tape = pushTape(tape, { ts: now, kind: "KILL", text: "KILL · flattened · halt", why: kill.note });
  }

  return {
    ...state,
    book,
    armed,
    lastPass: now,
    lastScan: scan,
    tape,
    jail,
    regime,
    regimeNote: note,
    killRung,
    killNote,
    failedOrders,
    chase: chase.slice(0, 24),
    decisions: decisions.slice(0, 80),
    slips,
    liveArmed: false,
  };
}

function fmtFill(cents: number): string {
  const n = cents / 100;
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
}
void fmtFill;

export function snapshot(state: DeskState, now: number): EngineSnapshot {
  const scan = state.lastScan;
  const candidates = scan?.candidates ?? [];
  const mismatch = Boolean(
    scan && state.book.seats.some((s) => !scan.candidates.some((c) => c.mint === s.mint) && !scan.majors.some((m) => m.symbol === s.symbol)),
  );
  const marks = marksFrom(scan, state.book, mismatch);
  const inSeats = markSeats(state.book.seats, marks);
  const equity = equityNet(state.book, marks);
  const gross = equityGross(state.book, marks);
  const today = equity - state.book.dayStartEquityCents;
  const hunt = candidates
    .filter((c) => c.gate === "PASS")
    .sort((a, b) => b.score - a.score)
    .slice(0, HUNT_BUBBLES);
  const last = state.lastPass;
  const heartbeat = last == null ? now - state.startedAt : now - last;
  const passers = candidates.filter(canEnter);
  const stale = Boolean(scan?.stale) || (last != null && now - last > STALE_AFTER_MS);
  const miss = state.armed && passers.length > 0 && state.book.seats.length === 0;
  const cap = seatCapacity(state.book);
  const frozenNew =
    blocksNewEntries(state.killRung) ||
    stale ||
    mismatch ||
    deployableCash(state.book) < 1_000;
  const would = frozenNew || state.book.seats.length >= cap
    ? passers.filter((c) => !state.book.seats.some((s) => s.mint === c.mint)).slice(0, 10)
    : [];
  const seated = state.book.seats.length;
  const coverage = cap > 0 ? seated / cap : 0;
  const overflow = Math.max(0, passers.length - Math.max(0, cap - seated));
  const dd = state.book.peakEquityCents > 0 ? Math.max(0, (state.book.peakEquityCents - equity) / state.book.peakEquityCents) : 0;
  const feedHealth: EngineSnapshot["feedHealth"] = !scan ? "DOWN" : scan.stale || stale ? "STALE" : "LIVE";

  return {
    asOf: last ?? state.startedAt,
    tz: "UTC",
    armed: state.armed,
    scanning: scan != null && !scan.stale,
    lastPass: last,
    heartbeatAgeMs: heartbeat,
    stale,
    feedError: scan?.error ?? null,
    latencyMs: scan?.latencyMs ?? 0,
    feedHealth,
    regime: state.regime,
    regimeNote: state.regimeNote,
    killRung: state.killRung,
    killNote: state.killNote,
    frozenNew,
    cashCents: state.book.cashCents,
    reserveCents: RESERVE_CENTS,
    deployableCents: deployableCash(state.book),
    inSeatsCents: inSeats,
    taxHoldCents: state.book.taxHoldCents,
    bankedCents: state.book.bankedCents,
    allocatedCents: state.book.cashCents + state.book.taxHoldCents + state.book.bankedCents + inSeats,
    sweepableCents: 0,
    equityCents: equity,
    equityGrossCents: gross,
    todayPnlCents: today,
    todayPnlPct: state.book.dayStartEquityCents ? today / state.book.dayStartEquityCents : 0,
    drawdownPct: dd,
    feesCents: state.book.feesCents,
    realizedAfterTaxCents: state.book.realizedAfterTaxCents,
    rungsTaken: state.book.rungsTaken,
    seatCapacity: cap,
    seatFloor: SEAT_FLOOR,
    rungProgressCents: Math.max(0, Math.min(RUNG_CENTS, rungProgress(state.book))),
    bankDestination: state.book.bankDestination,
    seats: state.book.seats,
    marks,
    candidates,
    hunt,
    jail: state.jail,
    tape: state.tape,
    majors: scan?.majors ?? [],
    macro: scan?.macro ?? [],
    universeCount: candidates.length,
    passCount: passers.length,
    miss,
    chase: state.chase,
    wouldHaveTaken: would,
    coverage,
    overflow,
    lastDecision: state.decisions[0] ?? null,
    decisions: state.decisions,
    slips: state.slips,
    failedOrders: state.failedOrders,
    liveArmed: false,
    houseMarks: scan?.houseMarks ?? {},
  };
}

export function arm(state: DeskState, now: number, on: boolean): DeskState {
  if (on && state.killRung === "kill") {
    return {
      ...state,
      tape: pushTape(state.tape, {
        ts: now,
        kind: "KILL",
        text: "START refused · desk is killed (≠ STOP). Flatten already ran.",
        why: state.killNote,
      }),
    };
  }
  return {
    ...state,
    armed: on,
    killRung: on && state.killRung === "pause_entries" ? state.killRung : on ? "clear" : state.killRung,
    tape: pushTape(state.tape, {
      ts: now,
      kind: "REGIME",
      text: on ? "START · paper autonomy armed · no per-trade approvals" : "STOP · autonomy idle (not a kill)",
      why: on ? "paper only" : "STOP ≠ kill ladder",
    }),
  };
}

export function cosignFlatten(state: DeskState, now: number, port: FillPort = paperFill): DeskState {
  let book = state.book;
  let tape = pushTape(state.tape, { ts: now, kind: "COSIGN", text: "co-sign flatten-all", why: "human flatten" });
  const marks = marksFrom(state.lastScan, book, false);
  for (const seat of [...book.seats]) {
    const px = marks[seat.mint] || seat.avgPx;
    const res = exit(book, seat.id, px, now, "cosign_flatten", seat.intel.liquidityUsd, port);
    if (res.ok) {
      book = res.book;
      tape = pushTape(tape, { ts: now, kind: "EXIT", text: `flatten ${seat.symbol}`, why: "cosign_flatten" });
    }
  }
  return { ...state, book, tape };
}

export function cosignDestination(state: DeskState, now: number, dest: BankDestination): DeskState {
  return {
    ...state,
    book: { ...state.book, bankDestination: dest },
    tape: pushTape(state.tape, { ts: now, kind: "COSIGN", text: `destination → ${dest}`, why: "co-sign destination" }),
  };
}

export function cosignMoveBanked(state: DeskState, now: number, cents: number): DeskState {
  const take = Math.min(state.book.bankedCents, Math.max(0, Math.round(cents)));
  if (take <= 0) return state;
  return {
    ...state,
    book: {
      ...state.book,
      bankedCents: state.book.bankedCents - take,
      cashCents: state.book.cashCents + take,
    },
    tape: pushTape(state.tape, {
      ts: now,
      kind: "COSIGN",
      text: `move banked $${(take / 100).toFixed(2)} → deployable`,
      why: "co-sign only · never auto-raid",
    }),
  };
}

void PAPER_SEED_CENTS;
