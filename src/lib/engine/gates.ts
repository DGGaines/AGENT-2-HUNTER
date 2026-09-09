import {
  CLIP_CENTS,
  HONEYPOT_MIN_AGE_MIN,
  HONEYPOT_MIN_BUYS,
  LAUNCH_MAX_AGE_MIN,
  MAX_BUY_SELL_RATIO,
  MAX_CLIP_IMPACT,
  MIN_H1_SELLS,
  MIN_H1_TXNS,
  MIN_H1_VOL_USD,
  MIN_LIQ_USD,
  PUMP_MIN_CHANGE_1H,
} from "../config.ts";
import { clusterOf, rugStack, sellSimAtClip, socialTag, tapeComplete } from "../ports/intel.ts";
import type { Candidate, GateCode } from "../types.ts";

export type RawCandidate = Omit<
  Candidate,
  | "gate"
  | "gateNote"
  | "book"
  | "impactAtClip"
  | "social"
  | "rug"
  | "sellSim"
  | "score"
  | "softFlags"
  | "intelComplete"
  | "intelAsOf"
  | "cluster"
  | "deployerId"
> & {
  intelAsOf?: number;
  deployerId?: string;
  cluster?: string;
};

export function impactAtClip(liquidityUsd: number, clipCents = CLIP_CENTS): number {
  if (liquidityUsd <= 0) return 1;
  return clipCents / 100 / liquidityUsd;
}

export function classifyBook(c: {
  pairAgeMin: number;
  change1h: number;
  venueKind: "dex" | "cex";
}): "LAUNCH" | "PUMP" | "NONE" {
  if (c.venueKind === "cex") {
    return c.change1h >= PUMP_MIN_CHANGE_1H ? "PUMP" : "NONE";
  }
  if (c.pairAgeMin <= LAUNCH_MAX_AGE_MIN) return "LAUNCH";
  if (c.change1h >= PUMP_MIN_CHANGE_1H) return "PUMP";
  return "NONE";
}

const STABLES = new Set(["USDT", "USDC", "DAI", "BUSD", "TUSD", "FDUSD", "USDE", "USDS", "USD1", "PYUSD"]);

function scoreOf(
  softFlags: string[],
  social: Candidate["social"],
  sellSim: Candidate["sellSim"],
  change1h: number,
): number {
  let s = 0.72;
  s += Math.min(0.22, Math.max(0, change1h) / 80);
  s -= softFlags.length * 0.12;
  if (social === "MIXED") s -= 0.18;
  s -= Math.min(0.2, sellSim.impact * 4);
  return Math.max(0.12, Math.min(0.95, s));
}

function evaluate(c: RawCandidate): {
  gate: GateCode;
  gateNote: string;
  softFlags: string[];
  social: Candidate["social"];
  rug: Candidate["rug"];
  sellSim: Candidate["sellSim"];
  intelComplete: boolean;
} {
  const intelComplete = tapeComplete(c);
  const sellSim = sellSimAtClip(c);
  const social = socialTag(c);
  const rug = rugStack({ ...c, sellSim, social });
  const impact = sellSim.impact;
  const softFlags: string[] = [];

  if (STABLES.has(c.symbol.toUpperCase())) {
    return {
      gate: "DENYLIST",
      gateNote: "stable — not a hunt seat",
      softFlags,
      social,
      rug,
      sellSim,
      intelComplete,
    };
  }

  if (!intelComplete || !(c.priceUsd > 0)) {
    return {
      gate: intelComplete ? "NO_PRICE" : "STALE_INTEL",
      gateNote: intelComplete ? "no mark" : "missing/stale intel — no trade",
      softFlags,
      social,
      rug,
      sellSim,
      intelComplete,
    };
  }

  // Honeypot shape BEFORE generic NO_SELLS — must be reachable.
  if (
    c.venueKind === "dex" &&
    c.pairAgeMin >= HONEYPOT_MIN_AGE_MIN &&
    c.sells1h === 0 &&
    c.buys1h >= HONEYPOT_MIN_BUYS
  ) {
    return {
      gate: "HONEYPOT_SHAPE",
      gateNote: "buys and no sells after 20m",
      softFlags,
      social,
      rug,
      sellSim,
      intelComplete,
    };
  }

  if (rug.flags.includes("DENYLIST")) {
    return { gate: "DENYLIST", gateNote: "public deny list", softFlags, social, rug, sellSim, intelComplete };
  }
  if (social === "INFLUENCER_DUMP") {
    return {
      gate: "DUMP",
      gateNote: "INFLUENCER_DUMP — hard refuse",
      softFlags,
      social,
      rug,
      sellSim,
      intelComplete,
    };
  }
  if (rug.hard && rug.flags.includes("WASH") === false && rug.flags.includes("GOPLUS") === false) {
    return { gate: "RUG", gateNote: rug.note, softFlags, social, rug, sellSim, intelComplete };
  }

  if (c.liquidityUsd < MIN_LIQ_USD && c.venueKind === "dex") {
    return {
      gate: "THIN_LP",
      gateNote: `lp $${Math.round(c.liquidityUsd)} < $${MIN_LIQ_USD}`,
      softFlags,
      social,
      rug,
      sellSim,
      intelComplete,
    };
  }
  if (impact > MAX_CLIP_IMPACT) {
    return {
      gate: "IMPACT",
      gateNote: `clip is ${(impact * 100).toFixed(1)}% of depth (max ${MAX_CLIP_IMPACT * 100}%)`,
      softFlags,
      social,
      rug,
      sellSim,
      intelComplete,
    };
  }
  if (c.venueKind === "dex" && c.sells1h < MIN_H1_SELLS) {
    return {
      gate: "NO_SELLS",
      gateNote: `${c.sells1h} sells in 1h — no observed exit`,
      softFlags,
      social,
      rug,
      sellSim,
      intelComplete,
    };
  }
  if (c.venueKind === "dex" && c.sells1h > 0 && c.buys1h / c.sells1h > MAX_BUY_SELL_RATIO) {
    return {
      gate: "WASH",
      gateNote: `buy/sell ${(c.buys1h / c.sells1h).toFixed(1)}`,
      softFlags,
      social,
      rug,
      sellSim,
      intelComplete,
    };
  }
  if (c.venueKind === "dex" && c.buyers1h > 0 && c.buys1h / c.buyers1h >= 4) {
    return {
      gate: "BUNDLE",
      gateNote: `buys/buyers ${(c.buys1h / c.buyers1h).toFixed(1)}`,
      softFlags,
      social,
      rug,
      sellSim,
      intelComplete,
    };
  }
  if (!sellSim.canExit) {
    return { gate: "IMPACT", gateNote: sellSim.note, softFlags, social, rug, sellSim, intelComplete };
  }

  if (c.venueKind === "dex" && c.buys1h + c.sells1h < MIN_H1_TXNS) {
    softFlags.push("LOW_TXNS");
  }
  if (c.volume1h < MIN_H1_VOL_USD) {
    softFlags.push("LOW_VOL");
  }
  if (social === "MIXED") softFlags.push("MIXED");

  return {
    gate: "PASS",
    gateNote: softFlags.length ? `sellable · size down ${softFlags.join("+")}` : "sellable at clip",
    softFlags,
    social,
    rug,
    sellSim,
    intelComplete,
  };
}

export function gateCandidate(raw: RawCandidate): Candidate {
  const book = classifyBook(raw);
  const ev = evaluate(raw);
  const score = ev.gate === "PASS" ? scoreOf(ev.softFlags, ev.social, ev.sellSim, raw.change1h) : 0;
  return {
    ...raw,
    impactAtClip: ev.sellSim.impact,
    book,
    gate: ev.gate,
    gateNote: ev.gateNote,
    social: ev.social,
    rug: ev.rug,
    sellSim: ev.sellSim,
    score,
    softFlags: ev.softFlags,
    intelComplete: ev.intelComplete,
    intelAsOf: raw.intelAsOf ?? 0,
    cluster: raw.cluster ?? clusterOf(raw),
    deployerId: raw.deployerId ?? raw.mint,
  };
}

export function canEnter(c: Candidate): boolean {
  return c.gate === "PASS" && c.intelComplete;
}

export function hardRefuse(c: Candidate): boolean {
  return c.gate !== "PASS";
}
