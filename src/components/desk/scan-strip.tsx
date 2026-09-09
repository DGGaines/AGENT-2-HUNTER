import { cn } from "@/lib/cn";
import { timeLocal } from "@/lib/format";
import { useDesk } from "@/lib/desk-store";

export function ScanStrip() {
  const snap = useDesk((s) => s.snap);
  const setArmed = useDesk((s) => s.setArmed);

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-3 py-2 lg:px-4">
      <div className="flex items-center gap-2 font-ui text-[12px] tracking-[0.14em]">
        <span
          className={cn(
            "size-2 rounded-full",
            snap.scanning && !snap.stale ? "bg-mint" : "bg-halt",
          )}
        />
        <span className={snap.scanning && !snap.stale ? "text-mint" : "text-halt"}>
          {snap.scanning && !snap.stale ? "SCANNING" : snap.stale ? "STALE" : "IDLE"}
        </span>
        <span className="text-muted">
          {snap.universeCount} PAIRS · {snap.passCount} SELLABLE
        </span>
        <span className="text-dim">
          LAST PASS {snap.lastPass ? timeLocal(snap.lastPass) : "—"}
        </span>
        <span
          className={cn(
            "px-2 py-0.5 text-[11px] tracking-[0.16em]",
            snap.regime === "FLAT"
              ? "bg-line text-muted"
              : snap.regime === "LAUNCH"
                ? "bg-magenta text-void"
                : "bg-mint text-void",
          )}
        >
          {snap.regime}
        </span>
        <span className="hidden text-dim md:inline">{snap.regimeNote}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setArmed(true, Date.now())}
          className="whitespace-nowrap bg-mint px-4 py-1.5 font-brand text-[11px] tracking-[0.2em] text-void"
        >
          START
        </button>
        <button
          type="button"
          onClick={() => setArmed(false, Date.now())}
          className="whitespace-nowrap border border-halt px-4 py-1.5 font-brand text-[11px] tracking-[0.2em] text-halt"
        >
          STOP
        </button>
        <button
          type="button"
          disabled
          title="Dead. Paper desk. No live adapter."
          className="whitespace-nowrap border border-live-dead px-3 py-1.5 font-brand text-[11px] tracking-[0.2em] text-live-dead"
        >
          LIVE · DEAD
        </button>
      </div>
    </div>
  );
}
