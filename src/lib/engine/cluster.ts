import { MAX_CLUSTER_SEATS } from "../config.ts";
import type { Candidate, Seat } from "../types.ts";

export function clusterOpen(seats: Seat[], c: Candidate, cap = MAX_CLUSTER_SEATS): boolean {
  const n = seats.filter((s) => s.cluster === c.cluster).length;
  return n < cap;
}
