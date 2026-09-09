import { useDesk } from "@/lib/desk-store";

export function Jail() {
  const jail = useDesk((s) => s.snap.jail);
  return (
    <section className="border border-line bg-panel p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-ui text-[12px] tracking-[0.22em] text-magenta">CRYPTO JAIL</h2>
        <span className="font-mono text-[11px] text-muted">{jail.length}</span>
      </div>
      <p className="mb-3 font-ui text-[11px] tracking-[0.08em] text-dim">
        No sell path. Off the scan. Hunter will not buy.
      </p>
      {jail.length === 0 ? (
        <div className="font-ui text-[12px] text-dim">empty</div>
      ) : (
        <ul className="max-h-56 space-y-1.5 overflow-auto">
          {jail.map((j) => (
            <li
              key={j.mint}
              className="flex items-center justify-between gap-2 border-l-2 border-magenta pl-2"
            >
              <span className="font-brand text-[11px] tracking-[0.12em] text-ink">
                {j.symbol}
              </span>
              <span className="truncate font-ui text-[11px] text-muted">{j.note}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
