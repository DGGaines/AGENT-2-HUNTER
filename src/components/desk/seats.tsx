import { CLIP_CENTS } from "@/lib/config";
import { money, moneyPx, pct } from "@/lib/format";
import { useDesk } from "@/lib/desk-store";
import { SellMeter } from "./sell-meter";

export function Seats() {
  const snap = useDesk((s) => s.snap);
  if (snap.seats.length === 0) {
    return (
      <div className="border border-dashed border-line px-3 py-2 font-ui text-[12px] tracking-[0.12em] text-dim">
        {snap.armed
          ? snap.miss
            ? "ARMED · MISS — passers on the tape, zero seats"
            : "ARMED · no seats this pass"
          : `IDLE · press START to take $${CLIP_CENTS / 100} clips (paper autonomy)`}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left font-mono text-[12px] tabular-nums">
        <thead className="font-ui text-[10px] tracking-[0.16em] text-muted">
          <tr>
            <th className="py-1 font-medium">SEAT</th>
            <th className="py-1 font-medium">STATE</th>
            <th className="py-1 font-medium">QTY</th>
            <th className="py-1 font-medium">AVG</th>
            <th className="py-1 font-medium">MARK</th>
            <th className="py-1 font-medium">U/R</th>
            <th className="py-1 font-medium">EXIT $250</th>
            <th className="py-1 font-medium">INTEL</th>
            <th className="py-1 font-medium">WHY</th>
          </tr>
        </thead>
        <tbody>
          {snap.seats.map((s) => {
            const mark = snap.marks[s.mint] ?? 0;
            const ur = s.avgPx > 0 ? ((mark - s.avgPx) / s.avgPx) * 100 : 0;
            return (
              <tr key={s.id} className="border-t border-line">
                <td className="py-1.5 text-magenta">
                  {s.symbol}
                  <div className="font-ui text-[9px] tracking-[0.1em] text-dim">
                    {s.cluster} · {s.venue}
                  </div>
                </td>
                <td className="text-muted">{s.state}</td>
                <td>{s.qty.toPrecision(4)}</td>
                <td>{moneyPx(s.avgPx)}</td>
                <td>{mark ? moneyPx(mark) : "$0"}</td>
                <td className={ur >= 0 ? "text-mint" : "text-halt"}>{pct(ur)}</td>
                <td>
                  <SellMeter sim={s.intel.sellSim} />
                </td>
                <td className="text-[10px] text-muted">
                  {s.intel.social}
                  <div className="text-dim">{s.intel.rug.note}</div>
                </td>
                <td className="max-w-[140px] truncate font-ui text-[11px] text-dim">{s.reason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-1 font-ui text-[10px] tracking-[0.12em] text-dim">
        {snap.seats.length}/{snap.seatCapacity} · floor {snap.seatFloor} · IN SEATS {money(snap.inSeatsCents)} · coverage{" "}
        {(snap.coverage * 100).toFixed(0)}%
      </div>
    </div>
  );
}
