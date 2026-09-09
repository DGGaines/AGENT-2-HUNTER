/**
 * Intel port — sell-sim, union rug, social tag.
 * Deterministic from public tape today. Later: GoPlus / RugCheck / list HTTP.
 * Missing or stale intel is a hard no-trade, not a guess.
 */
import {
  BUNDLE_BUYS_PER_BUYER,
  CLIP_CENTS,
  HONEYPOT_MIN_AGE_MIN,
  HONEYPOT_MIN_BUYS,
  INTEL_STALE_MS,
  MAX_BUY_SELL_RATIO,
  MAX_CLIP_IMPACT,
  MIN_LIQ_USD,
} from "../config.ts";
import type { Candidate, RugFlag, RugVerdict, SellSim, SocialTag } from "../types.ts";

const PUBLIC_DENY = new Set([
  "0x000000000000000000000000000000000000dead",
  "honeypot",
  "rugpull",
]);

export function sellSimAtClip(
  c: {
    priceUsd: number;
    liquidityUsd: number;
    sells1h: number;
    venueKind: "dex" | "cex";
    volume1h: number;
  },
  clipCents = CLIP_CENTS,
): SellSim {
  const clipUsd = clipCents / 100;
  const depth = c.venueKind === "cex" ? Math.max(c.liquidityUsd, c.volume1h * 8) : c.liquidityUsd;
  const impact = depth > 0 ? clipUsd / depth : 1;
  const canExit = c.priceUsd > 0 && depth >= MIN_LIQ_USD && impact <= MAX_CLIP_IMPACT;
  return {
    canExit,
    impact,
    depthUsd: depth,
    clipUsd,
    note: canExit
      ? `exit $${clipUsd.toFixed(0)} · impact ${(impact * 100).toFixed(2)}% · depth $${Math.round(depth)}`
      : `cannot exit $${clipUsd.toFixed(0)} · impact ${(impact * 100).toFixed(2)}% · depth $${Math.round(depth)}`,
  };
}

export function socialTag(c: {
  pairAgeMin: number;
  volume1h: number;
  liquidityUsd: number;
  change1h: number;
  buys1h: number;
  sells1h: number;
  venueKind: "dex" | "cex";
}): SocialTag {
  if (c.venueKind === "cex") return "ORGANIC";
  const boost = c.liquidityUsd > 0 && c.volume1h > c.liquidityUsd * 2.2 && c.pairAgeMin < 90;
  const dumpShape = boost && c.change1h >= 40 && c.sells1h > 0 && c.buys1h / c.sells1h > 5;
  if (dumpShape) return "INFLUENCER_DUMP";
  if (boost) return "MIXED";
  return "ORGANIC";
}

export function rugStack(c: {
  mint: string;
  symbol: string;
  name: string;
  sells1h: number;
  buys1h: number;
  buyers1h: number;
  pairAgeMin: number;
  liquidityUsd: number;
  sellSim: SellSim;
  social: SocialTag;
  observedFlags?: RugFlag[];
}): RugVerdict {
  const flags: RugFlag[] = [...(c.observedFlags ?? [])];
  const id = `${c.mint} ${c.symbol} ${c.name}`.toLowerCase();
  if ([...PUBLIC_DENY].some((d) => id.includes(d))) flags.push("DENYLIST");
  if (!c.sellSim.canExit) flags.push("SELL_SIM_FAIL");
  if (c.sells1h > 0 && c.buys1h / c.sells1h > MAX_BUY_SELL_RATIO) flags.push("WASH");
  if (c.buyers1h > 0 && c.buys1h / c.buyers1h >= BUNDLE_BUYS_PER_BUYER) flags.push("BUNDLE");
  if (
    c.pairAgeMin >= HONEYPOT_MIN_AGE_MIN &&
    c.sells1h === 0 &&
    c.buys1h >= HONEYPOT_MIN_BUYS
  ) {
    flags.push("GOPLUS");
  }
  if (c.social === "INFLUENCER_DUMP") flags.push("DEX_BOOST");
  if (c.social === "MIXED") flags.push("DEX_BOOST");
  const hard = flags.some((f) =>
    f === "DENYLIST" ||
    f === "GOPLUS" ||
    f === "WASH" ||
    f === "TAX_TRAP" ||
    f === "LP_PULL" ||
    f === "AUTHORITY_RISK" ||
    (f === "DEX_BOOST" && c.social === "INFLUENCER_DUMP"),
  );
  return {
    hard,
    flags,
    note: flags.length ? flags.join("+") : "clean",
  };
}

export function clusterOf(c: { symbol: string; name: string; chain: string; venueKind: "dex" | "cex" }): string {
  const blob = `${c.symbol} ${c.name}`.toLowerCase();
  if (/btc|eth|xrp|xlm|hbar|sol|doge|bnb|ltc|ada|etc/.test(c.symbol.toLowerCase()) && c.venueKind === "cex") {
    return "major";
  }
  if (/doge|shib|pepe|inu|moon|elon|floki|bonk|kishu|mog/.test(blob)) return "meme-dog";
  if (/ai|gpt|agent|neural|llm/.test(blob)) return "ai";
  if (/gold|xau|silver|oil/.test(blob)) return "macro";
  return c.chain || "unclustered";
}

export function intelFresh(asOf: number, now: number): boolean {
  return now - asOf <= INTEL_STALE_MS;
}

export function tapeComplete(c: {
  priceUsd: number;
  liquidityUsd: number;
  buys1h: number;
  sells1h: number;
  volume1h: number;
  venueKind: "dex" | "cex";
}): boolean {
  if (!(c.priceUsd > 0)) return false;
  if (c.venueKind === "cex") return c.volume1h > 0 || c.liquidityUsd > 0;
  return c.liquidityUsd > 0 && c.buys1h + c.sells1h > 0;
}
