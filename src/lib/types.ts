export type Regime = "LAUNCH" | "PUMP" | "FLAT";

export type VenueKind = "dex" | "cex";

export type SocialTag = "ORGANIC" | "MIXED" | "INFLUENCER_DUMP";

export type RiskKind = "soft" | "hard";

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
  | "STALE_INTEL"
  | "RUG"
  | "DUMP"
  | "BUNDLE"
  | "DENYLIST"
  | "SELL_SIM";

export type KillRung = "clear" | "pause_entries" | "cancel" | "close_only" | "flatten" | "kill";

export type BankDestination = "paper-hold" | "house-display" | "external";

export type ExitReason =
  | "stop"
  | "trail"
  | "time"
  | "gate_flip"
  | "sellability_lost"
  | "rug_flip"
  | "authority_flip"
  | "lp_flip"
  | "tax_flip"
  | "flatten"
  | "kill_close"
  | "manual"
  | "cosign_flatten";

export type SellSim = {
  canExit: boolean;
  impact: number;
  depthUsd: number;
  clipUsd: number;
  note: string;
};

export type RugFlag =
  | "SELL_SIM_FAIL"
  | "GOPLUS"
  | "RUGCHECK"
  | "DENYLIST"
  | "WASH"
  | "BUNDLE"
  | "DEPLOYER_GRAPH"
  | "LP_PULL"
  | "TAX_TRAP"
  | "AUTHORITY_RISK"
  | "DEX_BOOST";

export type RugVerdict = {
  hard: boolean;
  flags: RugFlag[];
  note: string;
};

export type IntelStamp = {
  asOf: number;
  complete: boolean;
  social: SocialTag;
  rug: RugVerdict;
  sellSim: SellSim;
  source: string;
  liquidityUsd: number;
};

export type Candidate = {
  id: string;
  symbol: string;
  name: string;
  mint: string;
  pairAddress: string;
  dex: string;
  chain: string;
  venue: string;
  venueKind: VenueKind;
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
  social: SocialTag;
  rug: RugVerdict;
  sellSim: SellSim;
  score: number;
  softFlags: string[];
  intelComplete: boolean;
  intelAsOf: number;
  cluster: string;
  deployerId: string;
};

export type MajorTick = {
  symbol: string;
  priceUsd: number;
  change24h: number;
};

export type MacroTick = {
  symbol: "DOW" | "GOLD" | "SILVER" | "OIL";
  price: number;
  change: number;
  stale: boolean;
};

export type ScanPayload = {
  asOf: number;
  source: string;
  stale: boolean;
  error: string | null;
  latencyMs: number;
  majors: MajorTick[];
  candidates: Candidate[];
  macro: MacroTick[];
  houseMarks: Record<string, { priceUsd: number; change24h: number }>;
};

export type Seat = {
  id: string;
  symbol: string;
  mint: string;
  pairAddress: string;
  chain: string;
  venue: string;
  cluster: string;
  deployerId: string;
  qty: number;
  avgPx: number;
  costCents: number;
  feesPaidCents: number;
  slipPaidCents: number;
  taxPaidCents: number;
  openedAt: number;
  peakPx: number;
  strategy: "LAUNCH" | "PUMP" | "MAJOR";
  clipCents: number;
  reason: string;
  intel: IntelStamp;
  state: "OPEN" | "EXITING";
};

export type Fill = {
  id: string;
  ts: number;
  side: "buy" | "sell";
  symbol: string;
  mint: string;
  venue: string;
  mode: "paper" | "live";
  qty: number;
  px: number;
  notionalCents: number;
  feeCents: number;
  slipCents: number;
  taxCents: number;
  impactBps: number;
  liquidity: "taker";
  reason: string;
  lotId: string;
};

export type TapeKind =
  | "SCAN"
  | "GATE"
  | "ENTER"
  | "EXIT"
  | "REFUSE"
  | "REGIME"
  | "MISS"
  | "CHASE"
  | "STALE"
  | "SWEEP"
  | "KILL"
  | "COSIGN"
  | "LEDGER";

export type TapeEvent = {
  id: string;
  ts: number;
  kind: TapeKind;
  text: string;
  why?: string;
};

export type JailEntry = {
  mint: string;
  symbol: string;
  reason: GateCode | ExitReason | "revenge" | "deployer";
  note: string;
  evidence: string;
  since: number;
  until: number;
  deployerId?: string;
};

export type DecisionRecord = {
  id: string;
  ts: number;
  mint: string;
  symbol: string;
  verdict: "PASS" | "REFUSE";
  gate: GateCode;
  note: string;
  confidence: number;
  strength: number;
  post?: "FALSE_PASS" | "FALSE_REFUSE" | "CONFIRMED";
  postNote?: string;
};

export type ChaseChip = {
  mint: string;
  symbol: string;
  why: "MISS" | "FROZEN" | "FULL";
  since: number;
  change1h: number;
  gate: GateCode;
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
  slipCents: number;
  taxCents: number;
  dayStartEquityCents: number;
  dayStamp: string;
  peakEquityCents: number;
  rungsTaken: number;
  paperRungLivePromote: false;
  bankDestination: BankDestination;
};

export type SlipSample = {
  ts: number;
  symbol: string;
  side: "buy" | "sell";
  paperBps: number;
  liveBps: number | null;
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
  latencyMs: number;
  feedHealth: "LIVE" | "STALE" | "DOWN";
  regime: Regime;
  regimeNote: string;
  killRung: KillRung;
  killNote: string;
  frozenNew: boolean;
  cashCents: number;
  reserveCents: number;
  deployableCents: number;
  inSeatsCents: number;
  taxHoldCents: number;
  bankedCents: number;
  allocatedCents: number;
  sweepableCents: number;
  equityCents: number;
  equityGrossCents: number;
  todayPnlCents: number;
  todayPnlPct: number;
  drawdownPct: number;
  feesCents: number;
  realizedAfterTaxCents: number;
  rungsTaken: number;
  seatCapacity: number;
  seatFloor: number;
  rungProgressCents: number;
  bankDestination: BankDestination;
  seats: Seat[];
  marks: Record<string, number>;
  candidates: Candidate[];
  hunt: Candidate[];
  jail: JailEntry[];
  tape: TapeEvent[];
  majors: MajorTick[];
  macro: MacroTick[];
  universeCount: number;
  passCount: number;
  miss: boolean;
  chase: ChaseChip[];
  wouldHaveTaken: Candidate[];
  coverage: number;
  overflow: number;
  lastDecision: DecisionRecord | null;
  decisions: DecisionRecord[];
  slips: SlipSample[];
  failedOrders: number;
  liveArmed: false;
  houseMarks: Record<string, { priceUsd: number; change24h: number }>;
};
