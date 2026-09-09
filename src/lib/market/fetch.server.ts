import { DEX_NETWORKS, LEDGER_SEEDS } from "../config.ts";
import type { Candidate, MacroTick, ScanPayload } from "../types.ts";
import { cexMarketsToCandidates, krakenToMajors, poolsToCandidates, yahooChartToMacro } from "./parse.ts";

const GT = "https://api.geckoterminal.com/api/v2/networks";
const KRAKEN =
  "https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD,XRPUSD,XLMUSD,SOLUSD,HBARUSD,DOGEUSD,ADAUSD,LTCUSD,DOTUSD,LINKUSD,AVAXUSD";
const CG_MARKETS =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=price_change_percentage_24h_desc&per_page=40&page=1&price_change_percentage=1h,24h";
const CG_NEW =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=15&page=1&price_change_percentage=1h,24h";
const YAHOO_CHART: Record<MacroTick["symbol"], string> = {
  DOW: "https://query1.finance.yahoo.com/v8/finance/chart/%5EDJI?interval=1d&range=2d",
  GOLD: "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=2d",
  SILVER: "https://query1.finance.yahoo.com/v8/finance/chart/SI%3DF?interval=1d&range=2d",
  OIL: "https://query1.finance.yahoo.com/v8/finance/chart/CL%3DF?interval=1d&range=2d",
};

type Cache = { at: number; payload: ScanPayload };
let cache: Cache | null = null;
const CACHE_MS = 12_000;

async function getJson(url: string, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Agent20PaperDesk/2.0" },
    });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

type GtBody = {
  data?: unknown[];
  included?: unknown[];
};

function mergeCandidates(lists: Candidate[][]): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const c of list) {
      const key = `${c.chain}:${c.mint}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
  }
  return out;
}

export async function fetchScan(now = Date.now()): Promise<ScanPayload> {
  if (cache && now - cache.at < CACHE_MS) return cache.payload;
  const t0 = Date.now();
  const errors: string[] = [];
  const candidateLists: Candidate[][] = [];
  let majors: ScanPayload["majors"] = [];
  let macro: MacroTick[] = [];
  const houseMarks: ScanPayload["houseMarks"] = {};

  const gtJobs = DEX_NETWORKS.flatMap((net) => [
    { net, url: `${GT}/${net}/trending_pools?include=base_token&page=1` },
    ...(net === "solana" || net === "eth" || net === "base"
      ? [{ net, url: `${GT}/${net}/new_pools?include=base_token&page=1` }]
      : []),
  ]);

  const geckoIds = LEDGER_SEEDS.map((l) => l.geckoId).filter(Boolean).join(",");
  const cgSimple = `https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds}&vs_currencies=usd&include_24hr_change=true`;

  const macroKeys = Object.keys(YAHOO_CHART) as Array<MacroTick["symbol"]>;
  const [gtResults, ticker, cgGain, cgNew, yahooCharts, simple] = await Promise.all([
    Promise.allSettled(gtJobs.map((j) => getJson(j.url, 8000))),
    Promise.allSettled([getJson(KRAKEN, 8000)]),
    Promise.allSettled([getJson(CG_MARKETS, 8000)]),
    Promise.allSettled([getJson(CG_NEW, 8000)]),
    Promise.allSettled(macroKeys.map((k) => getJson(YAHOO_CHART[k], 8000))),
    Promise.allSettled([getJson(cgSimple, 8000)]),
  ]);

  gtResults.forEach((r, i) => {
    const job = gtJobs[i]!;
    if (r.status === "rejected") {
      errors.push(`${job.net} ${String(r.reason?.message ?? r.reason)}`);
      return;
    }
    const body = r.value as GtBody;
    try {
      candidateLists.push(
        poolsToCandidates(
          (body.data ?? []) as Parameters<typeof poolsToCandidates>[0],
          (body.included ?? []) as Parameters<typeof poolsToCandidates>[1],
          now,
          job.net,
        ),
      );
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "pool parse");
    }
  });

  const kraken = ticker[0];
  if (kraken?.status === "fulfilled") {
    const body = kraken.value as { result?: Record<string, { c?: string[]; o?: string }> };
    if (body.result) majors = krakenToMajors(body.result);
  } else {
    errors.push("kraken majors");
  }

  for (const pack of [cgGain[0], cgNew[0]]) {
    if (pack?.status === "fulfilled" && Array.isArray(pack.value)) {
      candidateLists.push(
        cexMarketsToCandidates(pack.value as Parameters<typeof cexMarketsToCandidates>[0], now),
      );
    } else if (pack?.status === "rejected") {
      errors.push("coingecko cex");
    }
  }

  macro = macroKeys.map((key, i) => {
    const row = yahooCharts[i];
    if (row?.status === "fulfilled") {
      return yahooChartToMacro(key, row.value as Parameters<typeof yahooChartToMacro>[1]);
    }
    errors.push(`macro ${key}`);
    return { symbol: key, price: 0, change: 0, stale: true };
  });

  const sm = simple[0];
  if (sm?.status === "fulfilled" && sm.value && typeof sm.value === "object") {
    const body = sm.value as Record<string, { usd?: number; usd_24h_change?: number }>;
    for (const line of LEDGER_SEEDS) {
      if (!line.geckoId) continue;
      const row = body[line.geckoId];
      if (row?.usd) houseMarks[line.symbol] = { priceUsd: row.usd, change24h: row.usd_24h_change ?? 0 };
    }
  }

  for (const m of majors) {
    if (!houseMarks[m.symbol]) houseMarks[m.symbol] = { priceUsd: m.priceUsd, change24h: m.change24h };
  }

  const candidates = mergeCandidates(candidateLists);
  const tradingDown = candidates.length === 0;
  const payload: ScanPayload = {
    asOf: now,
    source: "gt-multichain+coingecko+kraken+yahoo",
    stale: tradingDown,
    error: errors.length ? errors.join(" · ") : null,
    latencyMs: Date.now() - t0,
    majors,
    candidates,
    macro,
    houseMarks,
  };
  cache = { at: now, payload };
  return payload;
}
