import { PAPER_SEED_CENTS, RESERVE_CENTS, RUNG_CENTS } from "@/lib/config";
import { money } from "@/lib/format";
import { useDesk } from "@/lib/desk-store";

export function Treasury() {
  const snap = useDesk((s) => s.snap);
  const fill = snap.rungProgressCents;
  const pct = Math.round((fill / RUNG_CENTS) * 100);

  return (
    <section>
      <h2 className="mb-2 font-ui text-[12px] tracking-[0.22em] text-muted">TREASURY</h2>
      <div className="grid grid-cols-3 gap-3">
        <Cell label="RESERVE" value={money(snap.reserveCents)} />
        <Cell label="BANKED" value={money(snap.bankedCents)} accent="magenta" />
        <Cell label="DEPLOYABLE" value={money(snap.deployableCents)} accent="mint" />
      </div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between font-ui text-[10px] tracking-[0.14em] text-dim">
          <span>RUNG → NEXT $1k NET</span>
          <span>
            {money(fill)} / {money(RUNG_CENTS)} · {snap.rungsTaken} taken · cap {snap.seatCapacity}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden bg-line">
          <div className="h-full bg-magenta" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-ui text-[11px] tracking-[0.12em] text-dim">
        <span>SEED {money(PAPER_SEED_CENTS)}</span>
        <span>CASH {money(snap.cashCents)}</span>
        <span>IN SEATS {money(snap.inSeatsCents)}</span>
        <span>TAX {money(snap.taxHoldCents)}</span>
        <span>FEES {money(snap.feesCents)}</span>
        <span>NET REALIZED {money(snap.realizedAfterTaxCents)}</span>
        <span>DEST {snap.bankDestination}</span>
        <span>RESERVE LOCK {money(RESERVE_CENTS)}</span>
      </div>
    </section>
  );
}

function Cell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "mint" | "magenta";
}) {
  const tone =
    accent === "mint" ? "text-mint" : accent === "magenta" ? "text-magenta" : "text-ink";
  return (
    <div className="border border-line bg-panel px-3 py-2">
      <div className="text-[10px] tracking-[0.16em] text-muted">{label}</div>
      <div className={`font-mono text-xl tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
