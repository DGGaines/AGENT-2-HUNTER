import type { HouseSymbol } from "./config.ts";

export type Regime = "LAUNCH" | "PUMP" | "FLAT";

export type GateCode =
  | "PASS"
  | "THIN_LP"
  | "IMPACT"
  | "NO_SELLS"
  | "LOW_TXNS"
  | "LOW_VOL"
  | "WASH"
  | "HONEYPOT_SHAPE"
  | "NO_PRICE"
  | "HOUSE_NAME";

export type Candidate = {
  id: string;
  symbol: string;
  name: string;
  mint: string;
  pairAddress: string;
  dex: string;
  priceUsd: number;
  change1h: number;
  change24h: number;
  liquidityUsd: number;
  volume1h: number;
  buys1h: number;
  sells1h: number;
  buyers1h: number;
  sellers1h: number;
  pairAgeMin: number;
  fdvUsd: number | null;
  decimals: number;
  imageUrl: string | null;
  impactAtClip: number;
  gate: GateCode;
  gateNote: string;
  book: "LAUNCH" | "PUMP" | "NONE";
};

export type MajorTick = {
  symbol: HouseSymbol | "SOL";
  priceUsd: number;
  change24h: number;
};

export type ScanPayload = {
  asOf: number;
  source: "geckoterminal+kraken";
  stale: boolean;
  error: string | null;
  majors: MajorTick[];
  candidates: Candidate[];
};

export type Seat = {
  id: string;
  symbol: string;
  mint: string;
  pairAddress: string;
  qty: number;
  avgPx: number;
  costCents: number;
  feesPaidCents: number;
  openedAt: number;
  peakPx: number;
  strategy: "LAUNCH" | "PUMP";
  clipCents: number;
};

export type Fill = {
  id: string;
  ts: number;
  side: "buy" | "sell";
  symbol: string;
  mint: string;
  qty: number;
  px: number;
  notionalCents: number;
  feeCents: number;
  slipCents: number;
  taxCents: number;
  liquidity: "taker";
  reason: string;
};

export type TapeKind =
  | "SCAN"
  | "GATE"
  | "ENTER"
  | "EXIT"
  | "REFUSE"
  | "REGIME"
  | "MISS"
  | "STALE"
  | "SWEEP";

export type TapeEvent = {
  id: string;
  ts: number;
  kind: TapeKind;
  text: string;
};

export type JailEntry = {
  mint: string;
  symbol: string;
  reason: GateCode;
  note: string;
  since: number;
};

export type Book = {
  cashCents: number;
  taxHoldCents: number;
  bankedCents: number;
  seats: Seat[];
  fills: Fill[];
  realizedCents: number;
  realizedAfterTaxCents: number;
  feesCents: number;
  dayStartEquityCents: number;
  dayStamp: string;
};

export type EngineSnapshot = {
  asOf: number;
  tz: "UTC";
  armed: boolean;
  scanning: boolean;
  lastPass: number | null;
  heartbeatAgeMs: number;
  stale: boolean;
  feedError: string | null;
  regime: Regime;
  regimeNote: string;
  cashCents: number;
  inSeatsCents: number;
  taxHoldCents: number;
  bankedCents: number;
  allocatedCents: number;
  sweepableCents: number;
  equityCents: number;
  equityGrossCents: number;
  todayPnlCents: number;
  todayPnlPct: number;
  feesCents: number;
  realizedAfterTaxCents: number;
  seats: Seat[];
  marks: Record<string, number>;
  candidates: Candidate[];
  hunt: Candidate[];
  jail: JailEntry[];
  tape: TapeEvent[];
  majors: MajorTick[];
  universeCount: number;
  passCount: number;
  miss: boolean;
};
