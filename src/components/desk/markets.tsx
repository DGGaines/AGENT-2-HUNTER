import { moneyPx, pct } from "@/lib/format";
import { useDesk } from "@/lib/desk-store";
import { SellMeter } from "./sell-meter";

type Tick = {
  key: string;
  symbol: string;
  px: number;
  change: number;
  tag: string;
};

function Chip({
  symbol,
  px,
  change,
  tag,
}: {
  symbol: string;
  px: number;
  change: number;
  tag: string;
}) {
  const up = change >= 0;
  return (
    <div className="flex shrink-0 items-center gap-2 px-2 py-0.5">
      <span className="font-brand text-[11px] tracking-[0.12em] text-ink">{symbol}</span>
      <span className="font-mono text-[11px] tabular-nums text-muted">{moneyPx(px)}</span>
      <span className={up ? "font-mono text-[11px] text-mint" : "font-mono text-[11px] text-halt"}>
        {pct(change)}
      </span>
      <span className="font-ui text-[9px] tracking-[0.14em] text-dim">{tag}</span>
      <span className="text-line" aria-hidden>
        /
      </span>
    </div>
  );
}

export function HuntRail() {
  const hunt = useDesk((s) => s.snap.hunt);
  const majors = useDesk((s) => s.snap.majors);

  const ticks: Tick[] = [
    ...majors.map((m) => ({
      key: `m-${m.symbol}`,
      symbol: m.symbol,
      px: m.priceUsd,
      change: m.change24h,
      tag: "24H",
    })),
    ...hunt.map((c) => ({
      key: `h-${c.mint}`,
      symbol: c.symbol,
      px: c.priceUsd,
      change: c.change1h,
      tag: c.book,
    })),
  ];

  if (ticks.length === 0) {
    return (
      <div className="border-t border-line px-3 py-2 font-ui text-[12px] tracking-[0.12em] text-dim">
        ticker dark · no marks
      </div>
    );
  }

  const set = ticks.map((t) => (
    <Chip key={t.key} symbol={t.symbol} px={t.px} change={t.change} tag={t.tag} />
  ));
  const seconds = Math.max(18, ticks.length * 3.2);

  return (
    <div className="ticker" role="marquee" aria-label="live marks">
      <div className="ticker-track" style={{ animationDuration: `${seconds}s` }}>
        <div className="ticker-set">{set}</div>
        <div className="ticker-set" aria-hidden="true">
          {ticks.map((t) => (
            <Chip key={`${t.key}-b`} symbol={t.symbol} px={t.px} change={t.change} tag={t.tag} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Markets() {
  const snap = useDesk((s) => s.snap);
  return (
    <section className="border border-line bg-panel p-3">
      <h2 className="mb-2 font-ui text-[12px] tracking-[0.22em] text-muted">HUNT / CANDIDATES</h2>
      <div className="max-h-56 space-y-1 overflow-auto font-mono text-[12px] tabular-nums">
        {snap.hunt.length === 0 && snap.majors.length === 0 ? (
          <div className="font-ui text-dim">no sellable names this pass</div>
        ) : null}
        {snap.hunt.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 border-b border-line py-1">
            <span className="w-16 text-magenta">{c.symbol}</span>
            <span className="text-dim">{c.chain}</span>
            <span className={c.change1h >= 0 ? "text-mint" : "text-halt"}>{pct(c.change1h)}</span>
            <span className="text-[10px] text-muted">{c.social}</span>
            <SellMeter sim={c.sellSim} />
          </div>
        ))}
        {snap.majors.map((m) => (
          <div key={m.symbol} className="flex justify-between gap-3 text-muted">
            <span>{m.symbol}</span>
            <span>{moneyPx(m.priceUsd)}</span>
            <span className={m.change24h >= 0 ? "text-mint" : "text-halt"}>{pct(m.change24h)}</span>
          </div>
        ))}
      </div>
      {snap.feedError ? <p className="mt-1 font-ui text-[11px] text-warn">{snap.feedError}</p> : null}
    </section>
  );
}
