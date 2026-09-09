import { useDesk } from "@/lib/desk-store";

export function Jail() {
  const jail = useDesk((s) => s.snap.jail);
  const now = useDesk((s) => s.now);
  return (
    <section className="border border-line bg-panel p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-ui text-[12px] tracking-[0.22em] text-magenta">JAIL</h2>
        <span className="font-mono text-[11px] text-muted">{jail.length}</span>
      </div>
      <p className="mb-3 font-ui text-[11px] tracking-[0.08em] text-dim">
        Evidence + TTL. Deployer and revenge stay off the book.
      </p>
      {jail.length === 0 ? (
        <div className="font-ui text-[12px] text-dim">empty</div>
      ) : (
        <ul className="max-h-56 space-y-1.5 overflow-auto">
          {jail.map((j) => {
            const ttl = Math.max(0, j.until - now);
            const mins = Math.round(ttl / 60_000);
            return (
              <li key={`${j.mint}-${j.reason}`} className="border-l-2 border-magenta pl-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-brand text-[11px] tracking-[0.12em] text-ink">{j.symbol}</span>
                  <span className="font-mono text-[10px] text-warn">{mins}m</span>
                </div>
                <div className="truncate font-ui text-[11px] text-muted">{j.note}</div>
                <div className="truncate font-ui text-[10px] text-dim">{j.evidence}</div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
