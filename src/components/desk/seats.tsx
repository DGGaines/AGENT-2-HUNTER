import { money, moneyPx, pct } from "@/lib/format";
import { useDesk } from "@/lib/desk-store";

export function Seats() {
  const snap = useDesk((s) => s.snap);
  if (snap.seats.length === 0) {
    return (
      <div className="border border-dashed border-line px-3 py-2 font-ui text-[12px] tracking-[0.12em] text-dim">
        {snap.armed
          ? snap.miss
            ? "ARMED · MISS — hunt regime, zero seats"
            : "ARMED · no seats this pass"
          : "IDLE · press START to take $20 clips"}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left font-mono text-[12px] tabular-nums">
        <thead className="font-ui text-[10px] tracking-[0.16em] text-muted">
          <tr>
            <th className="py-1 font-medium">SEAT</th>
            <th className="py-1 font-medium">QTY</th>
            <th className="py-1 font-medium">AVG</th>
            <th className="py-1 font-medium">MARK</th>
            <th className="py-1 font-medium">U/R</th>
            <th className="py-1 font-medium">BOOK</th>
          </tr>
        </thead>
        <tbody>
          {snap.seats.map((s) => {
            const mark = snap.marks[s.mint] ?? s.avgPx;
            const ur = ((mark - s.avgPx) / s.avgPx) * 100;
            return (
              <tr key={s.id} className="border-t border-line">
                <td className="py-1.5 text-magenta">{s.symbol}</td>
                <td>{s.qty.toPrecision(4)}</td>
                <td>{moneyPx(s.avgPx)}</td>
                <td>{moneyPx(mark)}</td>
                <td className={ur >= 0 ? "text-mint" : "text-halt"}>{pct(ur)}</td>
                <td className="text-muted">{s.strategy}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-1 font-ui text-[10px] tracking-[0.12em] text-dim">
        IN SEATS {money(snap.inSeatsCents)} · fees and slip already in the book
      </div>
    </div>
  );
}
