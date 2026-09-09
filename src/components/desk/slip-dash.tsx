import { useDesk } from "@/lib/desk-store";

export function SlipDash() {
  const slips = useDesk((s) => s.snap.slips);
  return (
    <section className="border border-line bg-panel p-3">
      <h2 className="mb-2 font-ui text-[12px] tracking-[0.22em] text-muted">PAPER vs LIVE SLIP</h2>
      <p className="mb-2 font-ui text-[10px] tracking-[0.08em] text-dim">
        Live adapter is stubbed. Live bps stay — until one arm.
      </p>
      {slips.length === 0 ? (
        <div className="font-ui text-[12px] text-dim">no lots yet</div>
      ) : (
        <ul className="max-h-36 space-y-1 overflow-auto font-mono text-[11px] tabular-nums">
          {slips.slice(0, 12).map((s, i) => (
            <li key={`${s.ts}-${s.symbol}-${i}`} className="flex justify-between gap-2">
              <span className="text-muted">
                {s.side.toUpperCase()} {s.symbol}
              </span>
              <span className="text-mint">P {s.paperBps}bps</span>
              <span className="text-live-dead">L {s.liveBps ?? "—"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
