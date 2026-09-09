import { useState } from "react";
import { HOUSEHOLD_TRANSFER_MODE } from "@/lib/config";
import { moneyPx } from "@/lib/format";
import { useDesk } from "@/lib/desk-store";
import type { HouseSymbol } from "@/lib/config";

export function HouseView() {
  const house = useDesk((s) => s.house);
  const majors = useDesk((s) => s.snap.majors);
  const deposit = useDesk((s) => s.houseDeposit);
  const withdraw = useDesk((s) => s.houseWithdraw);
  const setQty = useDesk((s) => s.setQty);
  const [amt, setAmt] = useState("0.00");
  const n = Number(amt);

  return (
    <div className="grid gap-4 p-3 lg:grid-cols-2 lg:p-4">
      <section className="border border-line bg-panel p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-brand text-[13px] tracking-[0.18em] text-ink">LEDGER COLD</h2>
          <span className="font-ui text-[10px] tracking-[0.16em] text-mint">HOUSE · NOT A SEAT</span>
        </div>
        <p className="mb-4 font-ui text-[12px] text-dim">
          Qty lives here. Marks from Kraken. Hunter cannot buy or sell these names.
        </p>
        <ul className="space-y-2">
          {house.ledger.map((line) => {
            const tick = majors.find((m) => m.symbol === line.symbol);
            const px = tick?.priceUsd ?? 0;
            const usd = line.qty * px;
            return (
              <li
                key={line.symbol}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2"
              >
                <span className="w-14 font-brand text-[12px] tracking-[0.12em]">{line.symbol}</span>
                <label className="flex min-w-0 flex-1 items-center gap-2 font-ui text-[11px] text-muted">
                  QTY
                  <input
                    className="min-w-0 flex-1 border border-line bg-void px-2 py-1 font-mono text-[12px] text-ink outline-none focus:border-magenta"
                    inputMode="decimal"
                    value={String(line.qty)}
                    onChange={(e) =>
                      setQty(line.symbol as HouseSymbol, Number(e.target.value) || 0)
                    }
                  />
                </label>
                <span className="font-mono text-[12px] tabular-nums">
                  {px ? moneyPx(px) : "—"}
                </span>
                <span
                  className={
                    (tick?.change24h ?? 0) >= 0
                      ? "font-mono text-[12px] text-mint"
                      : "font-mono text-[12px] text-halt"
                  }
                >
                  {usd ? moneyPx(usd) : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="border border-line bg-panel p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-brand text-[13px] tracking-[0.18em] text-ink">X MONEY</h2>
          <span className="font-ui text-[10px] tracking-[0.16em] text-mint">
            {HOUSEHOLD_TRANSFER_MODE.toUpperCase()}
          </span>
        </div>
        <div className="font-mono text-3xl tabular-nums text-mint">
          {house.xMoney.balance.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 font-ui text-[12px] text-muted">
          <Row k="APR" v={`${(house.xMoney.apr * 100).toFixed(2)}%`} />
          <Row
            k="DAILY"
            v={house.xMoney.daily.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 2,
            })}
          />
          <Row
            k="TODAY"
            v={house.xMoney.today.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
          />
          <Row
            k="LIFETIME"
            v={house.xMoney.lifetime.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
          />
        </div>

        <div className="mt-5 space-y-2">
          <div className="font-ui text-[11px] tracking-[0.14em] text-dim">
            DEPOSIT / WITHDRAW — display balance only. Does not move paper cash. Does not
            submit to a network. Swap the household port later; do not rewrite the desk.
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
