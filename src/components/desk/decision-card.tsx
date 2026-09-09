import { useDesk } from "@/lib/desk-store";
import { pct } from "@/lib/format";

export function DecisionCard() {
  const d = useDesk((s) => s.snap.lastDecision);
  if (!d) {
    return (
      <section className="border border-line bg-panel p-3 font-ui text-[12px] text-dim">
        <h2 className="mb-1 text-[12px] tracking-[0.22em] text-muted">DECISION</h2>
        waiting on a pass
      </section>
    );
  }
  const pass = d.verdict === "PASS";
  return (
    <section className="border border-line bg-panel p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-ui text-[12px] tracking-[0.22em] text-muted">DECISION</h2>
        <span className={pass ? "font-brand text-[11px] tracking-[0.16em] text-mint" : "font-brand text-[11px] tracking-[0.16em] text-halt"}>
          {d.verdict}
        </span>
      </div>
      <div className="font-brand text-[16px] tracking-[0.12em] text-ink">{d.symbol}</div>
      <div className="mt-1 font-ui text-[12px] text-muted">{d.note}</div>
      <div className="mt-2 flex gap-4 font-mono text-[11px] tabular-nums">
        <span className="text-mint">CONF {pct(d.confidence * 100, 0)}</span>
        <span className="text-dim">STR {d.strength.toFixed(0)}</span>
        <span className="text-muted">{d.gate}</span>
      </div>
      {d.post ? (
        <div className="mt-2 font-ui text-[11px] text-warn">
          {d.post} · {d.postNote}
        </div>
      ) : null}
    </section>
  );
}
