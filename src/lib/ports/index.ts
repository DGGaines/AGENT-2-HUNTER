/**
 * Oak roots. Live-ready ports. One engine talks only through these.
 *
 *   PaperFill  → book fills today
 *   LiveOrder  → stub; swap in a venue signer later, do not rewrite step.ts
 *   Intel      → sell-sim + rug + social (public tape now; GoPlus later)
 *   Household  → X Money / ledger display; never paper cash
 *   Feeds      → src/lib/market/fetch.server.ts (multi-venue, fail closed)
 */
export { paperFill, liveOrder, defaultFillPort } from "./fill.ts";
export type { FillPort, FillReport, OrderIntent } from "./fill.ts";
export { sellSimAtClip, socialTag, rugStack, clusterOf, intelFresh, tapeComplete } from "./intel.ts";
