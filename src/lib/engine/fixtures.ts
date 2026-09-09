import type { Candidate, ScanPayload } from "../types.ts";
import { gateCandidate } from "./gates.ts";

export function gem(over: Partial<Candidate> = {}): Candidate {
  return gateCandidate({
    id: over.id ?? "p1",
    symbol: over.symbol ?? "GEM",
    name: over.name ?? "Gem",
    mint: over.mint ?? "mint1",
    pairAddress: over.pairAddress ?? "pair1",
    dex: over.dex ?? "raydium",
    chain: over.chain ?? "solana",
    venue: over.venue ?? "gt:solana",
    venueKind: over.venueKind ?? "dex",
    priceUsd: over.priceUsd ?? 0.01,
    change1h: over.change1h ?? 22,
    change24h: over.change24h ?? 40,
    liquidityUsd: over.liquidityUsd ?? 80_000,
    volume1h: over.volume1h ?? 12_000,
    buys1h: over.buys1h ?? 80,
    sells1h: over.sells1h ?? 50,
    buyers1h: over.buyers1h ?? 40,
    sellers1h: over.sellers1h ?? 30,
    pairAgeMin: over.pairAgeMin ?? 40,
    fdvUsd: over.fdvUsd ?? 100_000,
    decimals: over.decimals ?? 6,
    imageUrl: over.imageUrl ?? null,
    intelAsOf: over.intelAsOf ?? Date.UTC(2026, 8, 9, 14, 0, 0),
    deployerId: over.deployerId,
    cluster: over.cluster,
  });
}

export function scanOf(candidates: Candidate[], now: number, over: Partial<ScanPayload> = {}): ScanPayload {
  return {
    asOf: now,
    source: "test",
    stale: false,
    error: null,
    latencyMs: 12,
    majors: [],
    candidates,
    macro: [],
    houseMarks: {},
    ...over,
  };
}
