import type { ScanPayload } from "../types.ts";
import { krakenToMajors, poolsToCandidates } from "./parse.ts";

const GT = "https://api.geckoterminal.com/api/v2/networks/solana";
const KRAKEN = "https://api.kraken.com/0/public/Ticker?pair=XBTUSD,ETHUSD,XRPUSD,XLMUSD,SOLUSD,HBARUSD";

type Cache = { at: number; payload: ScanPayload };
let cache: Cache | null = null;
const CACHE_MS = 12_000;

async function getJson(url: string, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "Agent2PaperDesk/1.0" },
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

export async function fetchScan(now = Date.now()): Promise<ScanPayload> {
  if (cache && now - cache.at < CACHE_MS) return cache.payload;
  const errors: string[] = [];
  let candidates: ScanPayload["candidates"] = [];
  let majors: ScanPayload["majors"] = [];

  const [trend, fresh, ticker] = await Promise.allSettled([
    getJson(`${GT}/trending_pools?include=base_token&page=1`, 8000),
    getJson(`${GT}/new_pools?include=base_token&page=1`, 8000),
    getJson(KRAKEN, 8000),
  ]);

  const pools: unknown[] = [];
  const included: unknown[] = [];
  for (const r of [trend, fresh]) {
    if (r.status === "rejected") {
      errors.push(String(r.reason?.message ?? r.reason));
      continue;
    }
    const body = r.value as GtBody;
    if (Array.isArray(body.data)) pools.push(...body.data);
    if (Array.isArray(body.included)) included.push(...body.included);
  }
  try {
    candidates = poolsToCandidates(
      pools as Parameters<typeof poolsToCandidates>[0],
      included as Parameters<typeof poolsToCandidates>[1],
      now,
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "pool parse");
  }

  if (ticker.status === "fulfilled") {
    const body = ticker.value as { result?: Record<string, { c?: string[]; o?: string }> };
    if (body.result) majors = krakenToMajors(body.result);
  } else {
    errors.push("kraken majors");
  }

  const stale = candidates.length === 0;
  const payload: ScanPayload = {
    asOf: now,
    source: "geckoterminal+kraken",
    stale,
    error: errors.length ? errors.join(" · ") : null,
    majors,
    candidates,
  };
  cache = { at: now, payload };
  return payload;
}
