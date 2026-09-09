import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/cn";
import { clockHms, money, pct, signedMoney } from "@/lib/format";
import { useDesk } from "@/lib/desk-store";

export function DeskHeader() {
  const snap = useDesk((s) => s.snap);
  const now = useDesk((s) => s.now);
  const started = useDesk((s) => s.desk.startedAt);
  const save = useDesk((s) => s.save);
  const view = useDesk((s) => s.view);
  const setView = useDesk((s) => s.setView);
  const up = now - started;
  const down = snap.lastPass == null ? 0 : Math.max(0, now - snap.lastPass);
  const pnlUp = snap.todayPnlCents >= 0;

  return (
    <header className="grid grid-cols-1 gap-3 border-b border-line px-3 py-2 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:px-4">
      <div className="flex items-center gap-3">
        <Mark />
        <div>
          <div className="font-brand text-[15px] font-bold tracking-[0.22em] text-magenta">
            {APP_NAME}
          </div>
          <button
            type="button"
            onClick={save}
            className="mt-1 border border-magenta px-2 py-0.5 font-brand text-[10px] tracking-[0.18em] text-magenta"
          >
            SAVE
          </button>
        </div>
        <div className="ml-2 hidden gap-5 sm:flex">
          <Clock label="UP" value={clockHms(up)} tone="magenta" />
          <Clock label="DOWN" value={clockHms(down)} tone="halt" />
        </div>
      </div>

      <div className="text-center font-ui text-[11px] tracking-[0.16em] text-muted">
        PAPER · NO QUEUE · GECKO+KRAKEN TAPE · 1H
        {snap.miss ? <span className="ml-2 text-halt">· MISS</span> : null}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 lg:justify-end">
        <Metric
          label="EQUITY (NET)"
          value={money(snap.equityCents)}
          tone="mint"
        />
        <Metric
          label="TODAY"
          value={signedMoney(snap.todayPnlCents)}
          tone={pnlUp ? "mint" : "halt"}
        />
        <Metric
          label="DAY P&L"
          value={pct(snap.todayPnlPct * 100)}
          tone={pnlUp ? "mint" : "halt"}
        />
        <div className="text-right">
          <div className="text-[10px] tracking-[0.16em] text-muted">HEARTBEAT</div>
          <div className="flex items-center justify-end gap-1.5 font-mono text-sm text-halt">
            <span className="heart-beat text-halt" aria-hidden>
              ♥
            </span>
            {Math.round(snap.heartbeatAgeMs / 1000)}s
            {snap.stale ? <span className="text-warn">STALE</span> : null}
          </div>
        </div>
        <div className="flex gap-1">
          <Tab on={view === "desk"} onClick={() => setView("desk")}>
            DESK
          </Tab>
          <Tab on={view === "house"} onClick={() => setView("house")}>
            HOUSE
          </Tab>
        </div>
      </div>
    </header>
  );
}

function Mark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden className="text-magenta">
      <path d="M16 3 L29 28 H3 Z" fill="none" stroke="currentColor" strokeWidth="2.2" />
    </svg>
  );
}

function Clock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "magenta" | "halt";
}) {
  return (
    <div>
      <div className={cn("text-[10px] tracking-[0.2em]", tone === "magenta" ? "text-magenta" : "text-halt")}>
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-lg tabular-nums",
          tone === "magenta" ? "text-magenta" : "text-halt",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "mint" | "halt";
}) {
  return (
    <div className="text-right">
      <div className="text-[10px] tracking-[0.16em] text-muted">{label}</div>
      <div
        className={cn(
          "font-mono text-xl font-medium tabular-nums",
          tone === "mint" ? "text-mint" : "text-halt",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Tab({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border px-2 py-1 font-brand text-[10px] tracking-[0.16em]",
        on ? "border-magenta bg-magenta/15 text-magenta" : "border-line text-muted",
      )}
    >
      {children}
    </button>
  );
}
