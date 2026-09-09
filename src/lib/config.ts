/**
 * Named constants. No silent defaults in the engine.
 * Change a rule here — do not special-case it in a strategy if.
 */

export const APP_NAME = "AGENT 2.0";
export const CLOCK_TZ = "UTC";

/** Paper seed in USD cents. */
export const PAPER_SEED_CENTS = 500_000;
export const RESERVE_CENTS = 50_000;
/** Max clip. ¼-Kelly may shrink under this. Never expand. */
export const CLIP_CENTS = 25_000;
export const MIN_KELLY_CLIP_CENTS = 1_000;
/** $1k fully-net realized = one rung. */
export const RUNG_CENTS = 100_000;
/** Of each rung: $500 sacred bank + $500 recycled to deployable. */
export const RUNG_BANK_CENTS = 50_000;
export const RUNG_RECYCLE_CENTS = 50_000;
/** Seat floor (not ceiling). +2 per completed $1k rung. */
export const SEAT_FLOOR = 15;
export const SEATS_PER_RUNG = 2;
export const MAX_CLUSTER_SEATS = 4;

/** Taker fee applied on every fill. 30 bps = 0.30%. */
export const TAKER_FEE_BPS = 30;
/** Extra slip modeled on every fill. 20 bps. */
export const SLIP_BPS = 20;
/** Short-term capital-gains withhold on realized gains. */
export const STCG_RATE = 0.22;

/** Sellability — $250 clip must be a small slice of reserves. */
export const MIN_LIQ_USD = 12_000;
export const MAX_CLIP_IMPACT = 0.025;
export const MIN_H1_TXNS = 12;
export const MIN_H1_SELLS = 3;
export const MIN_H1_VOL_USD = 2_000;
export const MAX_BUY_SELL_RATIO = 8;
export const HONEYPOT_MIN_AGE_MIN = 20;
export const HONEYPOT_MIN_BUYS = 10;
export const BUNDLE_BUYS_PER_BUYER = 4;
export const LP_COLLAPSE_PCT = 0.5;

/** Launch book: pair younger than this (minutes). */
export const LAUNCH_MAX_AGE_MIN = 180;
/** Pump book: 1h move at least this percent. */
export const PUMP_MIN_CHANGE_1H = 8;
export const REGIME_MIN_NAMES = 3;

export const LAUNCH_TIME_STOP_MS = 45 * 60_000;
export const PUMP_TIME_STOP_MS = 90 * 60_000;
export const MAJOR_TIME_STOP_MS = 240 * 60_000;
export const STOP_LOSS_PCT = 0.12;
export const TRAIL_ARM_PCT = 0.18;
export const TRAIL_GIVEBACK_PCT = 0.08;

export const SCAN_MS = 15_000;
export const STALE_AFTER_MS = 45_000;
export const DEADMAN_MS = 180_000;
export const JAIL_TTL_MS = 6 * 3_600_000;
export const DEPLOYER_JAIL_TTL_MS = 24 * 3_600_000;
export const REVENGE_TTL_MS = 4 * 3_600_000;
export const INTEL_STALE_MS = 90_000;

export const DAILY_LOSS_CLOSE_PCT = 0.08;
export const DRAWDOWN_CLOSE_PCT = 0.15;
export const FAILED_ORDERS_FLATTEN = 5;

export const HUNT_BUBBLES = 8;
export const QUARTER_KELLY = 0.25;

export const DEX_NETWORKS = ["solana", "eth", "bsc", "base", "polygon_pos", "arbitrum"] as const;

export const KRAKEN_PAIRS: Record<string, string> = {
  BTC: "XXBTZUSD",
  ETH: "XETHZUSD",
  XRP: "XXRPZUSD",
  XLM: "XXLMZUSD",
  HBAR: "HBARUSD",
  SOL: "SOLUSD",
  DOGE: "XDGUSD",
  ADA: "ADAUSD",
  LTC: "XLTCZUSD",
  DOT: "DOTUSD",
  LINK: "LINKUSD",
  AVAX: "AVAXUSD",
};

/**
 * Household transfer switch.
 * "display-only" = ADD/OUT mutate the HOUSE view, never paper cash, never a network submit.
 * A later real adapter replaces `src/lib/household/display-port.ts` and this constant.
 * Do not sprinkle mode checks through the UI.
 */
export const HOUSEHOLD_TRANSFER_MODE = "display-only" as const;

export const XMONEY_SEED = {
  balance: 27_571.51,
  apr: 0.06,
  lifetime: 88.51,
  month: 39.04,
  nextPayout: "2026-10-01",
} as const;

/** Seeded house ledger. Not paper cash. Marks come from feeds at runtime. */
export const LEDGER_SEEDS = [
  { symbol: "BTC", qty: 0.0329679, geckoId: "bitcoin" },
  { symbol: "ETH", qty: 0.00988852, geckoId: "ethereum" },
  { symbol: "XRP", qty: 10706.9, geckoId: "ripple" },
  { symbol: "XLM", qty: 10013.9, geckoId: "stellar" },
  { symbol: "HBAR", qty: 10048.2, geckoId: "hedera-hashgraph" },
  { symbol: "DOGE", qty: 6555.09, geckoId: "dogecoin" },
  { symbol: "BNB", qty: 0.43705, geckoId: "binancecoin" },
  { symbol: "LTC", qty: 3.16391, geckoId: "litecoin" },
  { symbol: "ADA", qty: 565.242, geckoId: "cardano" },
  { symbol: "EDGE", qty: 1037.91, geckoId: "edge" },
  { symbol: "XCN", qty: 15862, geckoId: "chain-2" },
  { symbol: "YFI", qty: 0.01753, geckoId: "yearn-finance" },
  { symbol: "ALGO", qty: 375.172, geckoId: "algorand" },
  { symbol: "ICP", qty: 9.88624, geckoId: "internet-computer" },
  { symbol: "NCT", qty: 2471.72, geckoId: "polyswarm" },
  { symbol: "PEPE", qty: 5_422_703, geckoId: "pepe" },
  { symbol: "MANA", qty: 220.243, geckoId: "decentraland" },
  { symbol: "VVS", qty: 125_000, geckoId: "vvs-finance" },
  { symbol: "POL", qty: 850, geckoId: "polygon-ecosystem-token" },
  { symbol: "ETC", qty: 2.4, geckoId: "ethereum-classic" },
  { symbol: "GALA", qty: 12_000, geckoId: "gala" },
  { symbol: "CRO", qty: 2400, geckoId: "crypto-com-chain" },
  { symbol: "MOG", qty: 15_000_000, geckoId: "mog-coin" },
  { symbol: "LUNC", qty: 850_000, geckoId: "terra-luna" },
  { symbol: "ELON", qty: 50_000_000, geckoId: "dogelon-mars" },
  { symbol: "TURBO", qty: 45_000, geckoId: "turbo" },
  { symbol: "IOTX", qty: 3200, geckoId: "iotex" },
  { symbol: "POLY", qty: 1800, geckoId: "polymath" },
  { symbol: "KISHU", qty: 800_000_000, geckoId: "kishu-inu" },
  { symbol: "SPELL", qty: 95_000, geckoId: "spell-token" },
  { symbol: "HERO", qty: 18_000, geckoId: "metahero" },
  { symbol: "SOL", qty: 0.85, geckoId: "solana" },
  { symbol: "YIELDX", qty: 420, geckoId: "" },
] as const;

export type LedgerSymbol = (typeof LEDGER_SEEDS)[number]["symbol"];
/** @deprecated house names may sit. Kept as the major-ring set. */
export const HOUSE_SYMBOLS = ["BTC", "ETH", "XRP", "XLM", "HBAR"] as const;
export type HouseSymbol = (typeof HOUSE_SYMBOLS)[number];
