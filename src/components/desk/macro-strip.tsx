import { moneyPx, pct } from "@/lib/format";
import { useDesk } from "@/lib/desk-store";

export function MacroStrip() {
  const macro = useDesk((s) => s.snap.macro);
  const items = macro.length
    ? macro
    : ([
        { symbol: "DOW", price: 0, change: 0, stale: true },
        { symbol: "GOLD", price: 0, change: 0, stale: true },
        { symbol: "SILVER", price: 0, change: 0, stale: true },
        { symbol: "OIL", price: 0, change: 0, stale: true },
      ] as const);
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-line bg-well px-3 py-1.5 sm:grid-cols-4 lg:px-4">
      {items.map((m) => (
        <div key={m.symbol} className="flex items-baseline justify-between gap-2">
          <span className="font-ui text-[10px] tracking-[0.16em] text-muted">{m.symbol}</span>
          <span className="font-mono text-[12px] tabular-nums">{m.price ? moneyPx(m.price) : "—"}</span>
          <span className={m.change >= 0 ? "font-mono text-[11px] text-mint" : "font-mono text-[11px] text-halt"}>
            {m.price ? pct(m.change) : "STALE"}
          </span>
        </div>
      ))}
    </div>
  );
}
