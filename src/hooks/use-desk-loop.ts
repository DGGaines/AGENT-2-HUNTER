import { useEffect } from "react";
import { SCAN_MS } from "@/lib/config.ts";
import { useDesk } from "@/lib/desk-store.ts";
import { scanMarket } from "@/lib/market/api.ts";
import type { ScanPayload } from "@/lib/types.ts";

export function useDeskLoop() {
  const hydrate = useDesk((s) => s.hydrate);
  const ingest = useDesk((s) => s.ingest);
  const tickNow = useDesk((s) => s.tickNow);
  const houseAccrue = useDesk((s) => s.houseAccrue);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const clock = window.setInterval(() => tickNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, [tickNow]);

  useEffect(() => {
    let alive = true;
    async function pass() {
      const now = Date.now();
      try {
        const scan = await scanMarket();
        if (!alive) return;
        ingest(scan, now);
        houseAccrue(SCAN_MS / 3_600_000);
      } catch (e) {
        if (!alive) return;
        const last = useDesk.getState().desk.lastScan;
        const stale: ScanPayload = {
          asOf: now,
          source: "geckoterminal+kraken",
          stale: true,
          error: e instanceof Error ? e.message : "scan failed",
          majors: last?.majors ?? [],
          candidates: last?.candidates ?? [],
        };
        ingest(stale, now);
      }
    }
    void pass();
    const id = window.setInterval(() => void pass(), SCAN_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [ingest, houseAccrue]);
}
