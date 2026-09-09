const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdFull = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

export function money(cents: number): string {
  return usd.format(cents / 100);
}

export function moneyPx(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return usd.format(n);
  if (n >= 1) return usd.format(n);
  return usdFull.format(n);
}

export function pct(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function signedMoney(cents: number): string {
  const n = cents / 100;
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${usd.format(Math.abs(n))}`;
}

export function clockHms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function timeLocal(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function compactQty(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return n.toFixed(0);
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(4);
}
