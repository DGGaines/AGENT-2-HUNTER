import { cn } from "@/lib/cn";
import { timeLocal } from "@/lib/format";
import { useDesk } from "@/lib/desk-store";
import type { TapeKind } from "@/lib/types";

const TONE: Record<TapeKind, string> = {
  SCAN: "text-muted",
  GATE: "text-warn",
  ENTER: "text-mint",
  EXIT: "text-magenta",
  REFUSE: "text-halt",
  REGIME: "text-magenta",
  MISS: "text-halt",
  CHASE: "text-warn",
  STALE: "text-warn",
  SWEEP: "text-mint",
  KILL: "text-halt",
  COSIGN: "text-magenta",
  LEDGER: "text-muted",
};

export function Tape() {
  const tape = useDesk((s) => s.snap.tape);
  return (
    <section className="flex min-h-[140px] flex-col border-t border-line bg-panel">
      <h2 className="px-3 pt-2 font-ui text-[12px] tracking-[0.22em] text-magenta">TAPE</h2>
      <div className="mt-1 max-h-40 overflow-auto px-3 pb-2">
        {tape.length === 0 ? (
          <div className="text-dim">no prints</div>
        ) : (
          <ul className="space-y-0.5">
            {tape.map((ev) => (
              <li
                key={ev.id}
                className={cn("tape-row flex gap-3 font-mono text-[11px] tabular-nums", TONE[ev.kind])}
              >
                <span className="w-24 shrink-0 text-dim">{timeLocal(ev.ts)}</span>
                <span className="w-14 shrink-0 tracking-[0.14em]">{ev.kind}</span>
                <span className="text-ink">{ev.text}</span>
                {ev.why ? <span className="ml-auto truncate text-dim">WHY {ev.why}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
