import { PAPER_SEED_CENTS, RESERVE_CENTS, RUNG_CENTS } from "@/lib/config";
import { money } from "@/lib/format";
import { useDesk } from "@/lib/desk-store";

export function Treasury() {
  const snap = useDesk((s) => s.snap);
  const rungFill = ((snap.realizedAfterTaxCents % RUNG_CENTS) + RUNG_CENTS) % RUNG_CENTS;

  return (
    <section>
      <h2 className="mb-2 font-ui text-[12px] tracking-[0.22em] text-muted">TREASURY</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Cell label="ALLOCATED" value={money(snap.allocatedCents)} />
        <Cell label="CASH" value={money(snap.cashCents)} />
        <Cell label="IN SEATS" value={money(snap.inSeatsCents)} accent />
        <Cell label="TAX HOLD" value={money(snap.taxHoldCents)} />
        <Cell label="BANKED" value={money(snap.bankedCents)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-ui text-[11px] tracking-[0.12em] text-dim">
        <span>PAPER SEED {money(PAPER_SEED_CENTS)}</span>
        <span>RESERVE {money(RESERVE_CENTS)}</span>
        <span>
          NEXT RUNG {money(rungFill)} of {money(RUNG_CENTS)}
        </span>
        <span>FEES {money(snap.feesCents)}</span>
        <span>NET REALIZED {money(snap.realizedAfterTaxCents)}</span>
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
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.16em] text-muted">{label}</div>
      <div
        className={
          accent
            ? "font-mono text-lg tabular-nums text-mint"
            : "font-mono text-lg tabular-nums text-ink"
        }
      >
        {value}
      </div>
    </div>
  );
}
