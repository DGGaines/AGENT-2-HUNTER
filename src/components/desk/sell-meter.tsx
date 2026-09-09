import { cn } from "@/lib/cn";
import type { SellSim } from "@/lib/types";

export function SellMeter({ sim }: { sim: SellSim }) {
  const pct = Math.max(0, Math.min(100, (1 - sim.impact / 0.05) * 100));
  return (
    <div className="min-w-[88px]" title={sim.note}>
      <div className="flex items-center justify-between font-ui text-[9px] tracking-[0.08em]">
        <span className={sim.canExit ? "text-mint" : "text-halt"}>{sim.canExit ? "EXIT" : "NO"}</span>
        <span className="text-dim">{(sim.impact * 100).toFixed(1)}%</span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden bg-line">
        <div
          className={cn("h-full", sim.canExit ? "bg-mint" : "bg-halt")}
          style={{ width: `${sim.canExit ? pct : 12}%` }}
        />
      </div>
    </div>
  );
}
