import { useState } from "react";
import { HOUSEHOLD_TRANSFER_MODE } from "@/lib/config";
import { moneyPx } from "@/lib/format";
import { useDesk } from "@/lib/desk-store";

export function HouseView() {
  const house = useDesk((s) => s.house);
  const marks = useDesk((s) => s.snap.houseMarks);
  const majors = useDesk((s) => s.snap.majors);
  const deposit = useDesk((s) => s.houseDeposit);
  const withdraw = useDesk((s) => s.houseWithdraw);
  const setQty = useDesk((s) => s.setQty);
  const [amt, setAmt] = useState("0.00");
  const n = Number(amt);

  return (
    <div className="grid gap-4 p-3 lg:grid-cols-[1.3fr_0.9fr] lg:p-4">
      <section className="border border-line bg-panel p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-brand text-[13px] tracking-[0.18em] text-ink">HOUSE LEDGER</h2>
          <span className="font-ui text-[10px] tracking-[0.16em] text-mint">LIVE MARKS · NOT PAPER</span>
        </div>
        <p className="mb-4 font-ui text-[12px] text-dim">
          Seeded inventory. Marks from the feed. Hunter may sit these names if they clear gates — this
          ledger is not a seat and not paper cash.
        </p>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-left font-mono text-[12px] tabular-nums">
            <thead className="sticky top-0 bg-panel font-ui text-[10px] tracking-[0.16em] text-muted">
              <tr>
                <th className="py-1 font-medium">SYM</th>
                <th className="py-1 font-medium">QTY</th>
                <th className="py-1 font-medium">MARK</th>
                <th className="py-1 font-medium">24H</th>
                <th className="py-1 font-medium">USD</th>
              </tr>
            </thead>
            <tbody>
              {house.ledger.map((line) => {
                const tick = marks[line.symbol] ?? majors.find((m) => m.symbol === line.symbol);
                const px = tick && "priceUsd" in tick ? tick.priceUsd : 0;
                const ch = tick && "change24h" in tick ? tick.change24h : 0;
                const usd = line.qty * px;
                return (
                  <tr key={line.symbol} className="border-t border-line">
                    <td className="py-1.5 font-brand tracking-[0.08em]">{line.symbol}</td>
                    <td>
                      <input
                        className="w-28 border border-line bg-void px-1 py-0.5 font-mono text-[12px] outline-none focus:border-magenta"
                        inputMode="decimal"
                        value={String(line.qty)}
                        onChange={(e) => setQty(line.symbol, Number(e.target.value) || 0)}
                        aria-label={`${line.symbol} qty`}
                      />
                    </td>
                    <td>{px ? moneyPx(px) : "—"}</td>
                    <td className={ch >= 0 ? "text-mint" : "text-halt"}>{px ? `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%` : "—"}</td>
                    <td className="text-ink">{px ? moneyPx(usd) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border border-line bg-panel p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-brand text-[13px] tracking-[0.18em] text-ink">X MONEY</h2>
          <span className="font-ui text-[10px] tracking-[0.16em] text-mint">
            {HOUSEHOLD_TRANSFER_MODE.toUpperCase()}
          </span>
        </div>
        <div className="font-mono text-3xl tabular-nums text-mint">
          {house.xMoney.balance.toLocaleString("en-US", { style: "currency", currency: "USD" })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 font-ui text-[12px] text-muted">
          <Row k="APY" v={`${(house.xMoney.apr * 100).toFixed(2)}%`} />
          <Row
            k="DAILY"
            v={house.xMoney.daily.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          />
          <Row
            k="MONTH"
            v={house.xMoney.month.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          />
          <Row
            k="LIFETIME"
            v={house.xMoney.lifetime.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          />
          <Row k="NEXT PAYOUT" v={house.xMoney.nextPayout} />
        </div>

        <div className="mt-5 space-y-2">
          <div className="font-ui text-[11px] tracking-[0.14em] text-dim">
            ADD / OUT — display balance only. Does not move paper cash. Does not submit to a network.
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="w-36 border border-line bg-void px-2 py-2 font-mono text-[13px] outline-none focus:border-magenta"
              inputMode="decimal"
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
              aria-label="Household transfer amount"
            />
            <button
              type="button"
              onClick={() => {
                if (n > 0) deposit(n);
              }}
              className="bg-mint px-4 py-2 font-brand text-[11px] tracking-[0.16em] text-void"
            >
              ADD
            </button>
            <button
              type="button"
              onClick={() => {
                if (n > 0) withdraw(n);
              }}
              className="border border-magenta px-4 py-2 font-brand text-[11px] tracking-[0.16em] text-magenta"
            >
              OUT
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-line py-1">
      <span>{k}</span>
      <span className="font-mono text-ink">{v}</span>
    </div>
  );
}
