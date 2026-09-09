import { useDesk } from "@/lib/desk-store";
import { pct } from "@/lib/format";
import { SellMeter } from "./sell-meter";

export function MissBoard() {
  const snap = useDesk((s) => s.snap);
  if (!snap.miss && snap.chase.length === 0 && snap.wouldHaveTaken.length === 0) return null;
  return (
    <section className="border border-halt/40 bg-panel p-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-3">
        <h2 className="font-ui text-[12px] tracking-[0.22em] text-halt">MISS / CHASE</h2>
        <span className="font-mono text-[11px] text-muted">
          overflow {snap.overflow} · coverage {(snap.coverage * 100).toFixed(0)}%
        </span>
        {snap.frozenNew ? <span className="font-ui text-[10px] tracking-[0.14em] text-warn">FROZEN NEW</span> : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {snap.chase.map((c) => (
          <span
            key={c.mint}
            className="border border-halt px-2 py-0.5 font-brand text-[10px] tracking-[0.12em] text-halt"
          >
            {c.symbol} · {c.why}
          </span>
        ))}
      </div>
      {snap.wouldHaveTaken.length > 0 ? (
        <div className="mt-3">
          <div className="mb-1 font-ui text-[10px] tracking-[0.16em] text-muted">WOULD HAVE TAKEN</div>
          <ul className="space-y-1">
            {snap.wouldHaveTaken.map((c) => (
              <li key={c.mint} className="flex items-center justify-between gap-2 font-mono text-[11px]">
                <span className="text-ink">{c.symbol}</span>
                <span className={c.change1h >= 0 ? "text-mint" : "text-halt"}>{pct(c.change1h)}</span>
                <SellMeter sim={c.sellSim} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
