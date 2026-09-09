/**
 * Named constants. No silent defaults in the engine.
 * Change a rule here — do not special-case it in a strategy if.
 */

export const APP_NAME = "AGENT 2.0";
export const CLOCK_TZ = "UTC";

/** Paper seed in USD cents. */
export const PAPER_SEED_CENTS = 500_000;
export const RESERVE_CENTS = 50_000;
export const CLIP_CENTS = 2_000;
export const RUNG_CENTS = 100_000;
export const MAX_SEATS = 4;

/** Taker fee applied on every fill. 30 bps = 0.30%. */
export const TAKER_FEE_BPS = 30;
/** Extra slip modeled on every fill. 20 bps. */
export const SLIP_BPS = 20;
/** Short-term capital-gains withhold on realized gains. */
export const STCG_RATE = 0.22;

/** Sellability — $20 clip must be a small slice of reserves. */
export const MIN_LIQ_USD = 8_000;
export const MAX_CLIP_IMPACT = 0.025;
export const MIN_H1_TXNS = 12;
export const MIN_H1_SELLS = 3;
export const MIN_H1_VOL_USD = 400;
export const MAX_BUY_SELL_RATIO = 8;
export const HONEYPOT_MIN_AGE_MIN = 20;
export const HONEYPOT_MIN_BUYS = 10;

/** Launch book: pair younger than this (minutes). */
export const LAUNCH_MAX_AGE_MIN = 180;
/** Pump book: 1h move at least this percent. */
export const PUMP_MIN_CHANGE_1H = 8;
export const REGIME_MIN_NAMES = 3;

export const LAUNCH_TIME_STOP_MS = 45 * 60_000;
export const PUMP_TIME_STOP_MS = 90 * 60_000;
export const STOP_LOSS_PCT = 0.12;
export const TRAIL_ARM_PCT = 0.18;
export const TRAIL_GIVEBACK_PCT = 0.08;

export const SCAN_MS = 15_000;
export const STALE_AFTER_MS = 45_000;

export const HUNT_BUBBLES = 8;

/** Visual satellites only. Hunter will not buy these. */
export const HOUSE_SYMBOLS = ["BTC", "ETH", "XRP", "XLM", "HBAR"] as const;
export type HouseSymbol = (typeof HOUSE_SYMBOLS)[number];

export const KRAKEN_PAIRS: Record<HouseSymbol | "SOL", string> = {
  BTC: "XXBTZUSD",
  ETH: "XETHZUSD",
  XRP: "XXRPZUSD",
  XLM: "XXLMZUSD",
  HBAR: "HBARUSD",
  SOL: "SOLUSD",
};

/**
 * Household transfer switch.
 * "display-only" = ADD/OUT mutate the HOUSE view, never paper cash, never a network submit.
 * A later real adapter replaces `src/lib/household/display-port.ts` and this constant.
 * Do not sprinkle mode checks through the UI.
 */
export const HOUSEHOLD_TRANSFER_MODE = "display-only" as const;
