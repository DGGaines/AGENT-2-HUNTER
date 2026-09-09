/** USD cents. Integer only at the cash layer. */

export function usdToCents(usd: number): number {
  if (!Number.isFinite(usd)) return 0;
  return Math.round(usd * 100);
}

export function centsToUsd(cents: number): number {
  return cents / 100;
}

export function applyBps(cents: number, bps: number): number {
  return Math.round((cents * bps) / 10_000);
}

export function clampCents(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}
