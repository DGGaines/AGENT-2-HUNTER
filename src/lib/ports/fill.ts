/**
 * Fill port — one engine, two adapters.
 * PaperFill is live today. LiveOrder is wired and dead until a single arm.
 * Swap the adapter; do not fork the book.
 */
import { CLIP_CENTS, SLIP_BPS, TAKER_FEE_BPS } from "../config.ts";
import type { Fill } from "../types.ts";
import { rid } from "../engine/ids.ts";
import { applyBps, usdToCents } from "../engine/money.ts";
import { withholdStcg } from "../engine/tax.ts";

export type OrderIntent = {
  side: "buy" | "sell";
  symbol: string;
  mint: string;
  venue: string;
  qty?: number;
  clipCents: number;
  markPx: number;
  liquidityUsd: number;
  reason: string;
  lotId: string;
  costCents?: number;
};

export type FillCtx = {
  now: number;
};

export type FillReport =
  | { ok: true; fill: Fill; paperBps: number; liveBps: number | null }
  | { ok: false; reason: string; paperBps?: number; liveBps?: number | null };

export type FillPort = {
  mode: "paper" | "live";
  name: string;
  submit(intent: OrderIntent, ctx: FillCtx): FillReport;
};

function ammImpact(clipUsd: number, liquidityUsd: number): number {
  if (!(liquidityUsd > 0)) return 1;
  return clipUsd / liquidityUsd;
}

function paperPx(side: "buy" | "sell", mark: number, impact: number): number {
  const slip = SLIP_BPS / 10_000;
  if (side === "buy") return mark * (1 + impact + slip);
  return mark * (1 - impact - slip);
}

export const paperFill: FillPort = {
  mode: "paper",
  name: "PaperFill",
  submit(intent, ctx) {
    if (!(intent.markPx > 0)) return { ok: false, reason: "no mark" };
    const clip = intent.side === "buy" ? intent.clipCents : 0;
    const impact =
      intent.side === "buy"
        ? ammImpact(clip / 100, intent.liquidityUsd)
        : ammImpact(((intent.qty ?? 0) * intent.markPx), intent.liquidityUsd);
    const px = paperPx(intent.side, intent.markPx, impact);
    if (!(px > 0)) return { ok: false, reason: "no px" };

    let qty = intent.qty ?? 0;
    let notional = 0;
    if (intent.side === "buy") {
      qty = intent.clipCents / 100 / px;
      notional = intent.clipCents;
    } else {
      if (!(qty > 0)) return { ok: false, reason: "no qty" };
      notional = usdToCents(qty * px);
    }

    const fee = applyBps(notional, TAKER_FEE_BPS);
    const slip = applyBps(notional, SLIP_BPS);
    const gain = intent.side === "sell" ? notional - fee - slip - (intent.costCents ?? 0) : 0;
    const tax = intent.side === "sell" ? withholdStcg(gain) : 0;
    const fill: Fill = {
      id: rid("f"),
      ts: ctx.now,
      side: intent.side,
      symbol: intent.symbol,
      mint: intent.mint,
      venue: intent.venue,
      mode: "paper",
      qty,
      px,
      notionalCents: notional,
      feeCents: fee,
      slipCents: slip,
      taxCents: tax,
      impactBps: Math.round(impact * 10_000),
      liquidity: "taker",
      reason: intent.reason,
      lotId: intent.lotId,
    };
    return { ok: true, fill, paperBps: fill.impactBps + SLIP_BPS, liveBps: null };
  },
};

/** Live adapter stub. Engine-ready. Does not submit. LIVE stays dead until one arm. */
export const liveOrder: FillPort = {
  mode: "live",
  name: "LiveOrder",
  submit() {
    return { ok: false, reason: "LIVE_DEAD", liveBps: null };
  },
};

export function defaultFillPort(): FillPort {
  return paperFill;
}

export function clipOrDefault(cents: number): number {
  return cents > 0 ? Math.min(cents, CLIP_CENTS) : CLIP_CENTS;
}
