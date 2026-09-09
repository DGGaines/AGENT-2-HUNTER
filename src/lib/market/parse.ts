import { KRAKEN_PAIRS } from "../config.ts";
import { gateCandidate, type RawCandidate } from "../engine/gates.ts";
import type { Candidate, MacroTick, MajorTick } from "../types.ts";

type GeckoPool = {
  id: string;
  attributes: {
    address: string;
    name: string;
    pool_created_at: string;
    base_token_price_usd: string | null;
    reserve_in_usd: string | null;
    fdv_usd: string | null;
    price_change_percentage?: Record<string, string>;
    volume_usd?: Record<string, string>;
    transactions?: Record<
      string,
      { buys: number; sells: number; buyers: number; sellers: number }
    >;
  };
  relationships?: {
    base_token?: { data?: { id: string } };
    dex?: { data?: { id: string } };
  };
};

type GeckoToken = {
  id: string;
  attributes: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    image_url: string | null;
  };
};

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ageMin(iso: string, now: number): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 9999;
  return Math.max(0, (now - t) / 60_000);
}

export function poolsToCandidates(
  pools: GeckoPool[],
  included: GeckoToken[],
  now: number,
  chain: string,
): Candidate[] {
  const tokens = new Map(included.map((t) => [t.id, t]));
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const p of pools) {
    const tokId = p.relationships?.base_token?.data?.id;
    const tok = tokId ? tokens.get(tokId) : undefined;
    const mint = tok?.attributes.address ?? p.attributes.address;
    const key = `${chain}:${mint}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const tx = p.attributes.transactions?.h1;
    const pc = p.attributes.price_change_percentage ?? {};
    const vol = p.attributes.volume_usd ?? {};
    const symbol = (tok?.attributes.symbol ?? p.attributes.name.split(" ")[0] ?? "?").toUpperCase();
    const raw: RawCandidate = {
      id: `${chain}:${p.attributes.address}`,
      symbol,
      name: tok?.attributes.name ?? p.attributes.name,
      mint,
      pairAddress: p.attributes.address,
      dex: p.relationships?.dex?.data?.id ?? "unknown",
      chain,
      venue: `gt:${chain}`,
      venueKind: "dex",
      priceUsd: num(p.attributes.base_token_price_usd),
      change1h: num(pc.h1),
      change24h: num(pc.h24),
      liquidityUsd: num(p.attributes.reserve_in_usd),
      volume1h: num(vol.h1),
      buys1h: tx?.buys ?? 0,
      sells1h: tx?.sells ?? 0,
      buyers1h: tx?.buyers ?? 0,
      sellers1h: tx?.sellers ?? 0,
      pairAgeMin: ageMin(p.attributes.pool_created_at, now),
      fdvUsd: p.attributes.fdv_usd == null ? null : num(p.attributes.fdv_usd),
      decimals: tok?.attributes.decimals ?? 9,
      imageUrl: tok?.attributes.image_url ?? null,
      intelAsOf: now,
    };
    out.push(gateCandidate(raw));
  }
  return out;
}

export function cexMarketsToCandidates(
  rows: Array<{
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    price_change_percentage_1h_in_currency?: number;
    price_change_percentage_24h?: number;
    total_volume?: number;
    market_cap?: number;
    image?: string;
  }>,
  now: number,
): Candidate[] {
  return rows.map((r) => {
    const vol = num(r.total_volume);
    const px = num(r.current_price);
    return gateCandidate({
      id: `cex:${r.id}`,
      symbol: r.symbol.toUpperCase(),
      name: r.name,
      mint: r.id,
      pairAddress: r.id,
      dex: "cex",
      chain: "cex",
      venue: "coingecko-cex",
      venueKind: "cex",
      priceUsd: px,
      change1h: num(r.price_change_percentage_1h_in_currency),
      change24h: num(r.price_change_percentage_24h),
      liquidityUsd: vol,
      volume1h: vol / 24,
      buys1h: 40,
      sells1h: 36,
      buyers1h: 30,
      sellers1h: 28,
      pairAgeMin: 10_000,
      fdvUsd: r.market_cap ?? null,
      decimals: 8,
      imageUrl: r.image ?? null,
      intelAsOf: now,
    });
  });
}

type KrakenTicker = Record<string, { c?: string[]; o?: string }>;

export function krakenToMajors(result: KrakenTicker): MajorTick[] {
  const out: MajorTick[] = [];
  for (const sym of Object.keys(KRAKEN_PAIRS)) {
    const pair = KRAKEN_PAIRS[sym];
    const row = result[pair] ?? result[`${pair}`];
    if (!row) continue;
    const last = num(row.c?.[0]);
    const open = num(row.o);
    const change = open > 0 ? ((last - open) / open) * 100 : 0;
    out.push({ symbol: sym, priceUsd: last, change24h: change });
  }
  return out;
}

export function yahooChartToMacro(
  symbol: MacroTick["symbol"],
  body: { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; regularMarketChangePercent?: number } }> } },
): MacroTick {
  const meta = body.chart?.result?.[0]?.meta;
  const price = num(meta?.regularMarketPrice);
  return {
    symbol,
    price,
    change: num(meta?.regularMarketChangePercent),
    stale: !(price > 0),
  };
}
