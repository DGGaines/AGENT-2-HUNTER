import { Constellation } from "./constellation";
import { CosignBar } from "./cosign";
import { DecisionCard } from "./decision-card";
import { DeskHeader } from "./header";
import { Jail } from "./jail";
import { HuntRail, Markets } from "./markets";
import { MacroStrip } from "./macro-strip";
import { MissBoard } from "./miss-board";
import { ScanStrip } from "./scan-strip";
import { Seats } from "./seats";
import { SlipDash } from "./slip-dash";
import { Tape } from "./tape";
import { Treasury } from "./treasury";
import { HouseView } from "@/components/house/house-view";
import { useDesk } from "@/lib/desk-store";
import { useDeskLoop } from "@/hooks/use-desk-loop";

export function DeskShell() {
  useDeskLoop();
  const view = useDesk((s) => s.view);
  const snap = useDesk((s) => s.snap);
  const ready = useDesk((s) => s.ready);

  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col bg-void">
        <div className="border-b border-line px-4 py-3">
          <div className="font-brand text-[15px] font-bold tracking-[0.22em] text-magenta">
            AGENT 2.0
          </div>
          <div className="mt-1 font-ui text-[11px] tracking-[0.16em] text-muted">
            PAPER · LOADING DESK
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-void">
      <DeskHeader />
      <MacroStrip />
      <ScanStrip />
      {view === "house" ? (
        <HouseView />
      ) : (
        <>
          <div className="grid flex-1 grid-cols-1 gap-4 p-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.95fr)] lg:p-4">
            <div className="flex min-w-0 flex-col gap-4">
              <Treasury />
              <Constellation
                hunt={snap.hunt}
                majors={snap.majors}
                seats={snap.seats}
                scanning={ready && snap.scanning}
              />
              <Seats />
              <MissBoard />
            </div>
            <div className="flex flex-col gap-4">
              <DecisionCard />
              <Jail />
              <Markets />
              <SlipDash />
              <CosignBar />
              <Rules />
            </div>
          </div>
          <Tape />
          <HuntRail />
        </>
      )}
    </div>
  );
}

function Rules() {
  return (
    <section className="border border-line bg-panel p-3 font-ui text-[11px] leading-relaxed tracking-[0.04em] text-dim">
      <h2 className="mb-2 text-[12px] tracking-[0.22em] text-muted">LAW</h2>
      <ul className="space-y-1">
        <li>If it cannot be sold at a $250 clip, it is not a candidate.</li>
        <li>Any name that clears gates may sit — including BTC ETH XRP XLM HBAR.</li>
        <li>Empty seats with passers is a MISS. Sideline bias is banned.</li>
        <li>Rung: $500 banked sacred + $500 recycled. Never raid the bank.</li>
        <li>START arms paper autonomy. Co-sign only flatten / dest / move banked.</li>
        <li>LIVE is dead. One engine. LiveOrder plugs in later — no rewrite.</li>
      </ul>
    </section>
  );
}
