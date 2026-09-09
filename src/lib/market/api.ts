import { createServerFn } from "@tanstack/react-start";
import type { ScanPayload } from "../types.ts";

export const scanMarket = createServerFn({ method: "POST" }).handler(
  async (): Promise<ScanPayload> => {
    const { fetchScan } = await import("./fetch.server.ts");
    return fetchScan();
  },
);
