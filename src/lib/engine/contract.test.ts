/**
 * Proof matrix — each test names the process and fails if that process is absent.
 * Do not weaken assertions to stay green.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  CLIP_CENTS,
  INTEL_STALE_MS,
  LP_COLLAPSE_PCT,
  MAX_CLUSTER_SEATS,
  PAPER_SEED_CENTS,
  RESERVE_CENTS,
  SEAT_FLOOR,
  STOP_LOSS_PCT,
  XMONEY_SEED,
} from "../config.ts";
import { useDesk } from "../desk-store.ts";
import { defaultHousehold } from "../household/display-port.ts";
import { intelFresh, sellSimAtClip } from "../ports/intel.ts";
import { applyRungs, emptyBook, enter, seatCapacity } from "./book.ts";
import { gem, scanOf } from "./fixtures.ts";
import { canEnter } from "./gates.ts";
import { applyScan, arm, bootDesk, cosignFlatten, cosignMoveBanked, snapshot } from "./step.ts";

const T0 = Date.UTC(2026, 8, 9, 18, 0, 0);

function passer(over: Parameters<typeof gem>[0] = {}) {
  return gem({ intelAsOf: T0, ...over });
}

test("1 sell-sim at $250 clip fails → refuse (not THIN_LP)", () => {
  const c = gem({
    symbol: "WIDE",
    venueKind: "cex",
    chain: "cex",
    venue: "cex",
    liquidityUsd: 5_000,
    volume1h: 100,
    sells1h: 40,
    buys1h: 40,
    priceUsd: 2,
    intelAsOf: T0,
  });
  assert.equal(c.sellSim.clipUsd, 250);
  assert.equal(c.sellSim.canExit, false);
  assert.equal(c.gate, "SELL_SIM");
  assert.notEqual(c.gate, "THIN_LP");
  const res = enter(emptyBook(T0), c, T0);
  assert.equal(res.ok, false);
  if (res.ok) throw new Error("SELL_SIM must refuse enter");
  assert.equal(res.reason, "gate SELL_SIM");
  assert.equal(res.book.seats.length, 0);
  assert.equal(res.book.cashCents, PAPER_SEED_CENTS);
});

test("2 auto-chase: MISS→CHASE pulls the missed name through the full pack first", () => {
  const missed = passer({ id: "chase", symbol: "CHASEME", mint: "chase1", change1h: 12, cluster: "solo-chase" });
  const hotter = passer({ id: "hot", symbol: "HOT", mint: "hot1", change1h: 80, cluster: "solo-hot" });
  let desk = arm(bootDesk(T0), T0, true);
  desk = applyScan(desk, scanOf([missed], T0, { stale: true }), T0 + 1);
  assert.equal(desk.book.seats.length, 0);
  assert.ok(
    desk.chase.some((ch) => ch.mint === "chase1" && ch.why === "FROZEN"),
    `chase chips: ${desk.chase.map((c) => c.mint + ":" + c.why).join(",")}`,
  );
  assert.ok(desk.tape.some((t) => t.kind === "MISS"));
  assert.ok(desk.tape.some((t) => t.kind === "CHASE" && t.text.includes("CHASEME")));

  const freshMissed = passer({
    id: "chase",
    symbol: "CHASEME",
    mint: "chase1",
    change1h: 12,
    cluster: "solo-chase",
    intelAsOf: T0 + 2_000,
  });
  const freshHot = passer({
    id: "hot",
    symbol: "HOT",
    mint: "hot1",
    change1h: 80,
    cluster: "solo-hot",
    intelAsOf: T0 + 2_000,
  });
  desk = applyScan(desk, scanOf([freshHot, freshMissed], T0 + 2_000), T0 + 2_000);
  const enters = desk.tape.filter((t) => t.kind === "ENTER");
  assert.ok(enters.length >= 1, "chase pass must enter");
  const firstFill = enters[enters.length - 1]!;
  assert.match(firstFill.text, /CHASEME/);
  assert.equal(desk.book.seats[0]?.mint, "chase1");
  const seat = desk.book.seats.find((s) => s.mint === "chase1");
  assert.ok(seat, "chased mint must sit after the pack");
  assert.equal(seat!.intel.social, "ORGANIC");
  assert.equal(seat!.intel.sellSim.canExit, true);
  assert.equal(seat!.intel.sellSim.clipUsd, 250);
  assert.ok(seat!.intel.rug.note.length > 0);
  assert.ok(canEnter(freshMissed));
});

test("3 false-pass ledger records and post-marks when a passer rugs", () => {
  const ok = passer({ mint: "fp1", symbol: "FAKEOK" });
  let desk = arm(bootDesk(T0), T0, true);
  desk = applyScan(desk, scanOf([ok], T0), T0 + 1);
  assert.ok(desk.decisions.some((d) => d.mint === "fp1" && d.verdict === "PASS" && !d.post));
  const flipped = gem({
    mint: "fp1",
    symbol: "FAKEOK",
    intelAsOf: T0 + 2,
    observedFlags: ["LP_PULL"],
  });
  assert.equal(flipped.gate, "RUG");
  assert.ok(flipped.rug.flags.includes("LP_PULL"));
  desk = applyScan(desk, scanOf([flipped], T0 + 2), T0 + 2);
  const rec = desk.decisions.find((d) => d.mint === "fp1" && d.verdict === "PASS");
  assert.ok(rec);
  assert.equal(rec!.post, "FALSE_PASS");
  assert.match(rec!.postNote ?? "", /RUG after pass/);
});

test("4 false-refuse ledger records and post-marks when a refuse later runs", () => {
  const pack = Array.from({ length: 5 }, (_, i) =>
    passer({
      id: `mr${i}`,
      symbol: `DOG${i}`,
      mint: `dog${i}`,
      name: "doge inu",
      cluster: "meme-dog",
      deployerId: `dog${i}`,
      change1h: 10 + i,
    }),
  );
  let desk = arm(bootDesk(T0), T0, true);
  desk = applyScan(desk, scanOf(pack, T0), T0 + 1);
  const refused = desk.decisions.find((d) => d.verdict === "REFUSE" && d.note.includes("cluster"));
  assert.ok(refused);
  const later = pack.map((c) =>
    gem({
      mint: c.mint,
      symbol: c.symbol,
      name: c.name,
      cluster: "meme-dog",
      deployerId: c.deployerId,
      change1h: 22,
      intelAsOf: T0 + 3,
    }),
  );
  desk = applyScan(desk, scanOf(later, T0 + 3), T0 + 3);
  const marked = desk.decisions.find((d) => d.id === refused!.id);
  assert.ok(marked, "original refuse row must remain in the ledger");
  assert.equal(marked!.post, "FALSE_REFUSE");
  assert.match(marked!.postNote ?? "", /ran \+/);
});

test("5 cluster/correlation cap blocks 15 seats of one narrative", () => {
  const names = Array.from({ length: 15 }, (_, i) =>
    passer({
      id: `n${i}`,
      symbol: `PEPE${i}`,
      name: "pepe inu moon",
      mint: `meme${i}`,
      cluster: "meme-dog",
      deployerId: `meme${i}`,
    }),
  );
  let desk = arm(bootDesk(T0), T0, true);
  desk = applyScan(desk, scanOf(names, T0), T0 + 1);
  const same = desk.book.seats.filter((s) => s.cluster === "meme-dog");
  assert.equal(same.length, MAX_CLUSTER_SEATS);
  assert.ok(same.length < 15);
  assert.ok(desk.tape.some((t) => t.why === "cluster/correlation seat cap"));
  assert.ok(desk.decisions.some((d) => d.verdict === "REFUSE" && d.note.includes("cluster")));
});

test("6a post-entry authority flip → authority_flip exit + deployer jail", () => {
  const ok = passer({ mint: "auth1", symbol: "AUTH", deployerId: "dep-auth" });
  let desk = arm(bootDesk(T0), T0, true);
  desk = applyScan(desk, scanOf([ok], T0), T0 + 1);
  assert.equal(desk.book.seats.some((s) => s.mint === "auth1"), true);
  const flipped = gem({
    mint: "auth1",
    symbol: "AUTH",
    deployerId: "dep-auth",
    intelAsOf: T0 + 2,
    observedFlags: ["AUTHORITY_RISK"],
  });
  desk = applyScan(desk, scanOf([flipped], T0 + 2), T0 + 2);
  assert.equal(desk.book.seats.some((s) => s.mint === "auth1"), false);
  assert.ok(desk.tape.some((t) => t.kind === "EXIT" && t.why === "authority_flip"));
  assert.ok(desk.jail.some((j) => j.reason === "deployer" && j.deployerId === "dep-auth" && j.note === "authority_flip"));
});

test("6b post-entry LP collapse → lp_flip exit + deployer jail", () => {
  const ok = passer({ mint: "lp1", symbol: "LPX", deployerId: "dep-lp", liquidityUsd: 80_000 });
  let desk = arm(bootDesk(T0), T0, true);
  desk = applyScan(desk, scanOf([ok], T0), T0 + 1);
  assert.equal(desk.book.seats[0]?.intel.liquidityUsd, 80_000);
  const collapsed = passer({
    mint: "lp1",
    symbol: "LPX",
    deployerId: "dep-lp",
    liquidityUsd: 20_000,
    intelAsOf: T0 + 2,
  });
  assert.ok(20_000 < 80_000 * LP_COLLAPSE_PCT);
  desk = applyScan(desk, scanOf([collapsed], T0 + 2), T0 + 2);
  assert.equal(desk.book.seats.some((s) => s.mint === "lp1"), false);
  assert.ok(desk.tape.some((t) => t.kind === "EXIT" && t.why === "lp_flip"));
  assert.ok(desk.jail.some((j) => j.reason === "deployer" && j.note === "lp_flip"));
});

test("6c post-entry tax trap → tax_flip exit + deployer jail", () => {
  const ok = passer({ mint: "tax1", symbol: "TAXX", deployerId: "dep-tax" });
  let desk = arm(bootDesk(T0), T0, true);
  desk = applyScan(desk, scanOf([ok], T0), T0 + 1);
  const trapped = gem({
    mint: "tax1",
    symbol: "TAXX",
    deployerId: "dep-tax",
    intelAsOf: T0 + 2,
    observedFlags: ["TAX_TRAP"],
  });
  desk = applyScan(desk, scanOf([trapped], T0 + 2), T0 + 2);
  assert.equal(desk.book.seats.some((s) => s.mint === "tax1"), false);
  assert.ok(desk.tape.some((t) => t.kind === "EXIT" && t.why === "tax_flip"));
  assert.ok(desk.jail.some((j) => j.reason === "deployer" && j.note === "tax_flip"));
});

test("7 would-have-taken board when frozen or full", () => {
  const frozenNames = [passer({ symbol: "WAIT", mint: "wait1" })];
  let desk = arm(bootDesk(T0), T0, true);
  desk = applyScan(desk, scanOf(frozenNames, T0, { stale: true }), T0 + 1);
  let snap = snapshot(desk, T0 + 1);
  assert.equal(snap.frozenNew, true);
  assert.ok(snap.wouldHaveTaken.some((c) => c.mint === "wait1"));

  let book = emptyBook(T0);
  const seated = Array.from({ length: SEAT_FLOOR }, (_, i) =>
    passer({ id: `s${i}`, symbol: `S${i}`, mint: `full${i}`, cluster: `c${i}`, deployerId: `full${i}` }),
  );
  for (const c of seated) {
    const r = enter(book, c, T0);
    assert.equal(r.ok, true);
    if (r.ok) book = r.book;
  }
  assert.equal(book.seats.length, SEAT_FLOOR);
  desk = { ...arm(bootDesk(T0), T0, true), book };
  const extra = passer({ symbol: "LEFT", mint: "left1", cluster: "c-left", deployerId: "left1" });
  desk = applyScan(desk, scanOf([...seated, extra], T0), T0 + 2);
  snap = snapshot(desk, T0 + 2);
  assert.equal(desk.book.seats.length, SEAT_FLOOR);
  assert.ok(
    snap.wouldHaveTaken.some((c) => c.mint === "left1"),
    "full book must list left1 on would-have-taken",
  );
  assert.ok(
    desk.chase.some((ch) => ch.mint === "left1" && ch.why === "FULL"),
    "full book must chase left1 as FULL",
  );
  assert.ok(snap.overflow >= 1);
});

test("8 exit-depth meter: can I exit $250 right now", () => {
  const ok = sellSimAtClip({
    priceUsd: 1,
    liquidityUsd: 80_000,
    sells1h: 20,
    venueKind: "dex",
    volume1h: 10_000,
  });
  assert.equal(ok.clipUsd, CLIP_CENTS / 100);
  assert.equal(ok.canExit, true);
  assert.ok(Math.abs(ok.impact - 250 / 80_000) < 1e-12);
  const no = sellSimAtClip({
    priceUsd: 1,
    liquidityUsd: 5_000,
    sells1h: 20,
    venueKind: "dex",
    volume1h: 400,
  });
  assert.equal(no.clipUsd, 250);
  assert.equal(no.canExit, false);
  assert.ok(no.impact > 0.025);
  const c = passer();
  const bought = enter(emptyBook(T0), c, T0);
  assert.equal(bought.ok, true);
  if (!bought.ok) return;
  assert.equal(bought.book.seats[0]!.intel.sellSim.clipUsd, 250);
  assert.equal(bought.book.seats[0]!.intel.sellSim.canExit, true);
});

test("9 X Money ADD/OUT never mutates paper cash or the book", () => {
  let desk = arm(bootDesk(T0), T0, true);
  desk = applyScan(desk, scanOf([passer({ mint: "keepx", symbol: "KEEPX" })], T0), T0 + 1);
  assert.equal(desk.book.seats.length, 1);
  useDesk.setState({ desk, house: defaultHousehold(), now: T0 + 1 });
  const before = structuredClone(useDesk.getState().desk.book);
  useDesk.getState().houseDeposit(10);
  useDesk.getState().houseWithdraw(3);
  const after = useDesk.getState();
  assert.deepEqual(after.desk.book, before);
  assert.equal(after.desk.book.cashCents, before.cashCents);
  assert.equal(after.desk.book.bankedCents, before.bankedCents);
  assert.equal(after.desk.book.seats.length, 1);
  assert.equal(after.desk.book.seats[0]!.mint, "keepx");
  assert.ok(Math.abs(after.house.xMoney.balance - (XMONEY_SEED.balance + 7)) < 1e-9);
  assert.notEqual(after.house.xMoney.balance, after.desk.book.cashCents / 100);
});

test("10 INFLUENCER_DUMP and MIXED hard-refuse even when depth would sell", () => {
  const dump = gem({
    symbol: "KOL",
    liquidityUsd: 80_000,
    volume1h: 200_000,
    pairAgeMin: 30,
    change1h: 50,
    buys1h: 80,
    sells1h: 12,
    buyers1h: 40,
    intelAsOf: T0,
  });
  assert.equal(dump.sellSim.canExit, true);
  assert.equal(dump.social, "INFLUENCER_DUMP");
  assert.equal(dump.gate, "DUMP");
  assert.equal(enter(emptyBook(T0), dump, T0).ok, false);

  const mixed = gem({
    symbol: "BOOST",
    liquidityUsd: 80_000,
    volume1h: 200_000,
    pairAgeMin: 30,
    change1h: 10,
    buys1h: 40,
    sells1h: 30,
    buyers1h: 30,
    intelAsOf: T0,
  });
  assert.equal(mixed.sellSim.canExit, true);
  assert.equal(mixed.social, "MIXED");
  assert.equal(mixed.gate, "DUMP");
  assert.equal(enter(emptyBook(T0), mixed, T0).ok, false);
});

test("11 co-sign required for flatten-all and move-banked; START does not bypass", () => {
  const c = passer({ mint: "keep1", symbol: "KEEP" });
  let desk = arm(bootDesk(T0), T0, true);
  desk = applyScan(desk, scanOf([c], T0), T0 + 1);
  assert.equal(desk.book.seats.length, 1);
  desk = {
    ...desk,
    book: { ...desk.book, bankedCents: 50_000, cashCents: desk.book.cashCents },
  };
  const banked = desk.book.bankedCents;
  const seatId = desk.book.seats[0]!.id;
  desk = arm(desk, T0 + 2, true);
  desk = applyScan(desk, scanOf([c], T0 + 2), T0 + 2);
  assert.equal(desk.book.bankedCents, banked);
  assert.ok(desk.book.seats.some((s) => s.id === seatId));
  assert.ok(desk.tape.some((t) => t.text.includes("START · paper autonomy armed")));
  assert.equal(desk.tape.some((t) => t.kind === "COSIGN" && t.text.includes("flatten")), false);
  assert.equal(desk.tape.some((t) => t.why === "cosign_flatten"), false);

  desk = cosignMoveBanked(desk, T0 + 3, 10_000);
  assert.equal(desk.book.bankedCents, banked - 10_000);
  assert.ok(desk.tape.some((t) => t.kind === "COSIGN" && t.text.includes("move banked")));

  desk = cosignFlatten(desk, T0 + 4);
  assert.equal(desk.book.seats.length, 0);
  assert.ok(desk.tape.some((t) => t.why === "cosign_flatten"));
});

test("12 paper rung stays non-live-promotable and cannot auto-promote", () => {
  let book = emptyBook(T0);
  book = applyRungs({
    ...book,
    cashCents: PAPER_SEED_CENTS + 100_000,
    realizedAfterTaxCents: 100_000,
  });
  assert.equal(book.paperRungLivePromote, false);
  assert.equal(book.rungsTaken, 1);
  assert.equal(seatCapacity(book), SEAT_FLOOR + 2);
  let desk = { ...arm(bootDesk(T0), T0, true), book };
  desk = applyScan(desk, scanOf([passer()], T0), T0 + 1);
  assert.equal(desk.book.paperRungLivePromote, false);
  assert.equal(desk.liveArmed, false);
  assert.equal(snapshot(desk, T0 + 1).liveArmed, false);
});

test("13 fail-closed: stale or missing social/rug intel → no trade", () => {
  const staleIntel = passer({ mint: "old1", intelAsOf: T0 - INTEL_STALE_MS - 1_000 });
  assert.equal(staleIntel.gate, "PASS");
  assert.equal(intelFresh(staleIntel.intelAsOf, T0), false);
  let desk = arm(bootDesk(T0), T0, true);
  desk = applyScan(desk, scanOf([staleIntel], T0, { stale: false }), T0);
  assert.equal(desk.book.seats.length, 0);
  assert.equal(desk.tape.some((t) => t.kind === "ENTER"), false);
  const staleEnter = enter(emptyBook(T0), staleIntel, T0);
  assert.equal(staleEnter.ok, false);
  if (staleEnter.ok) throw new Error("stale intel must refuse enter");
  assert.equal(staleEnter.reason, "stale intel");

  const missingAsOf = passer({ mint: "zero1", intelAsOf: 0 });
  assert.equal(missingAsOf.intelAsOf, 0);
  assert.equal(canEnter(missingAsOf), false);
  const missingEnter = enter(emptyBook(T0), missingAsOf, T0);
  assert.equal(missingEnter.ok, false);
  if (missingEnter.ok) throw new Error("missing intelAsOf must refuse enter");
  assert.equal(missingEnter.reason, "missing intel");

  const missingTape = gem({
    mint: "mute1",
    buys1h: 0,
    sells1h: 0,
    volume1h: 0,
    liquidityUsd: 80_000,
    intelAsOf: T0,
  });
  assert.equal(missingTape.intelComplete, false);
  assert.equal(missingTape.gate, "STALE_INTEL");
  const mute = enter(emptyBook(T0), missingTape, T0);
  assert.equal(mute.ok, false);
  if (mute.ok) throw new Error("missing tape must refuse enter");
  assert.equal(mute.reason, "gate STALE_INTEL");
});

test("14 revenge trading blocked after a loss; bank stays unraided", () => {
  const c = passer({ mint: "loser1", symbol: "LOSE", priceUsd: 1 });
  let desk = arm(bootDesk(T0), T0, true);
  desk = applyScan(desk, scanOf([c], T0), T0 + 1);
  assert.equal(desk.book.seats.length, 1);
  const banked = desk.book.bankedCents;
  const crashed = passer({ mint: "loser1", symbol: "LOSE", priceUsd: 0.8, intelAsOf: T0 + 2 });
  assert.ok((0.8 - 1) / 1 <= -STOP_LOSS_PCT);
  desk = applyScan(desk, scanOf([crashed], T0 + 2), T0 + 2);
  assert.equal(desk.book.seats.length, 0);
  assert.ok(desk.tape.some((t) => t.kind === "EXIT" && t.why === "stop"));
  assert.ok(desk.jail.some((j) => j.mint === "loser1" && j.reason === "revenge"));
  const recovered = passer({ mint: "loser1", symbol: "LOSE", priceUsd: 1.2, intelAsOf: T0 + 3 });
  desk = applyScan(desk, scanOf([recovered], T0 + 3), T0 + 3);
  assert.equal(desk.book.seats.some((s) => s.mint === "loser1"), false);
  assert.ok(desk.tape.some((t) => t.kind === "REFUSE" && t.why === "jail/revenge/deployer"));
  assert.equal(desk.book.bankedCents, banked);
  assert.ok(desk.book.cashCents >= RESERVE_CENTS);
});
