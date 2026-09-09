import {
  CLIP_CENTS,
  HONEYPOT_MIN_AGE_MIN,
  HONEYPOT_MIN_BUYS,
  HOUSE_SYMBOLS,
  LAUNCH_MAX_AGE_MIN,
  MAX_BUY_SELL_RATIO,
  MAX_CLIP_IMPACT,
  MIN_H1_SELLS,
  MIN_H1_TXNS,
  MIN_H1_VOL_USD,
  MIN_LIQ_USD,
  PUMP_MIN_CHANGE_1H,
} from "../config.ts";
import type { Candidate, GateCode } from "../types.ts";

const HOUSE = new Set<string>(HOUSE_SYMBOLS);

export function impactAtClip(liquidityUsd: number): number {
  if (liquidityUsd <= 0) return 1;
  return CLIP_CENTS / 100 / liquidityUsd;
}

export function classifyBook(c: {
  pairAgeMin: number;
  change1h: number;
}): "LAUNCH" | "PUMP" | "NONE" {
  if (c.pairAgeMin <= LAUNCH_MAX_AGE_MIN) return "LAUNCH";
  if (c.change1h >= PUMP_MIN_CHANGE_1H) return "PUMP";
  return "NONE";
}

export function gateCandidate(raw: Omit<Candidate, "gate" | "gateNote" | "book" | "impactAtClip">): Candidate {
  const impact = impactAtClip(raw.liquidityUsd);
  const book = classifyBook(raw);
  const { gate, gateNote } = evaluate(raw, impact);
  return { ...raw, impactAtClip: impact, book, gate, gateNote };
}

function evaluate(
  c: Omit<Candidate, "gate" | "gateNote" | "book" | "impactAtClip">,
  impact: number,
): { gate: GateCode; gateNote: string } {
  const sym = c.symbol.toUpperCase();
  if (HOUSE.has(sym)) {
    return { gate: "HOUSE_NAME", gateNote: "household satellite — hunter will not buy" };
  }
  if (!(c.priceUsd > 0)) {
    return { gate: "NO_PRICE", gateNote: "no mark" };
  }
  if (c.liquidityUsd < MIN_LIQ_USD) {
    return {
      gate: "THIN_LP",
      gateNote: `lp $${Math.round(c.liquidityUsd)} < $${MIN_LIQ_USD}`,
    };
  }
  if (impact > MAX_CLIP_IMPACT) {
    return {
      gate: "IMPACT",
      gateNote: `clip is ${(impact * 100).toFixed(1)}% of lp (max ${MAX_CLIP_IMPACT * 100}%)`,
    };
  }
  if (c.sells1h < MIN_H1_SELLS) {
    return {
      gate: "NO_SELLS",
      gateNote: `${c.sells1h} sells in 1h — no observed exit`,
    };
  }
  if (c.buys1h + c.sells1h < MIN_H1_TXNS) {
    return { gate: "LOW_TXNS", gateNote: `${c.buys1h + c.sells1h} tx 1h` };
  }
  if (c.volume1h < MIN_H1_VOL_USD) {
    return { gate: "LOW_VOL", gateNote: `vol 1h $${Math.round(c.volume1h)}` };
  }
  if (c.sells1h > 0 && c.buys1h / c.sells1h > MAX_BUY_SELL_RATIO) {
    return {
      gate: "WASH",
      gateNote: `buy/sell ${ (c.buys1h / c.sells1h).toFixed(1) }`,
    };
  }
  if (
    c.pairAgeMin >= HONEYPOT_MIN_AGE_MIN &&
    c.sells1h === 0 &&
    c.buys1h >= HONEYPOT_MIN_BUYS
  ) {
    return {
      gate: "HONEYPOT_SHAPE",
      gateNote: "buys and no sells after 20m",
    };
  }
  return { gate: "PASS", gateNote: "sellable at clip" };
}

export function canEnter(c: Candidate): boolean {
  return c.gate === "PASS" && (c.book === "LAUNCH" || c.book === "PUMP");
}
