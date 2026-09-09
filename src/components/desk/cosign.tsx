import { useState } from "react";
import type { BankDestination } from "@/lib/types";
import { useDesk } from "@/lib/desk-store";

export function CosignBar() {
  const flattenAll = useDesk((s) => s.flattenAll);
  const setDestination = useDesk((s) => s.setDestination);
  const moveBanked = useDesk((s) => s.moveBanked);
  const dest = useDesk((s) => s.snap.bankDestination);
  const banked = useDesk((s) => s.snap.bankedCents);
  const [amt, setAmt] = useState("0");

  return (
    <section className="border border-line bg-panel p-3">
      <h2 className="mb-2 font-ui text-[12px] tracking-[0.22em] text-muted">CO-SIGN</h2>
      <p className="mb-2 font-ui text-[10px] tracking-[0.08em] text-dim">
        Only flatten-all, destination, move banked. START already arms autonomy.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => flattenAll(Date.now())}
          className="border border-halt px-3 py-1 font-brand text-[10px] tracking-[0.16em] text-halt"
        >
          FLATTEN ALL
        </button>
        {(["paper-hold", "house-display", "external"] as BankDestination[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDestination(d, Date.now())}
            className={
              dest === d
                ? "border border-magenta bg-magenta/15 px-2 py-1 font-brand text-[10px] tracking-[0.12em] text-magenta"
                : "border border-line px-2 py-1 font-brand text-[10px] tracking-[0.12em] text-muted"
            }
          >
            {d}
          </button>
        ))}
        <input
          className="w-20 border border-line bg-void px-2 py-1 font-mono text-[11px] outline-none focus:border-magenta"
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          aria-label="Move banked dollars"
        />
        <button
          type="button"
          onClick={() => {
            const n = Number(amt);
            if (n > 0) moveBanked(Math.round(n * 100), Date.now());
          }}
          className="border border-magenta px-3 py-1 font-brand text-[10px] tracking-[0.14em] text-magenta"
        >
          MOVE BANKED
        </button>
        <span className="font-mono text-[10px] text-dim">${(banked / 100).toFixed(2)} banked</span>
      </div>
    </section>
  );
}
