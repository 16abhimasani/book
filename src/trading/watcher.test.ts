import { describe, expect, test } from "bun:test";
import { detectTriggers, type WatchConfig, type HeldPosition } from "./watcher";
import type { Quote } from "./yahoo";

const cfg: WatchConfig = { symbols: ["SPCX", "NVDA"], moveAlertPct: 5, stopProximityPct: 3 };
const q = (symbol: string, price: number, prevClose: number): [string, Quote] => [symbol, { symbol, price, prevClose }];

describe("detectTriggers", () => {
  test("watchlist name moving ≥ threshold fires MOVE", () => {
    const fired = detectTriggers([], cfg, new Map([q("SPCX", 122, 100), q("NVDA", 101, 100)]));
    expect(fired.some((f) => f.startsWith("MOVE SPCX +22.0%"))).toBe(true);
    expect(fired.some((f) => f.includes("NVDA"))).toBe(false); // +1% < 5%
  });

  test("held name near its stop fires STOP-ADJACENT", () => {
    const held: HeldPosition[] = [{ symbol: "DAL", stop: 82.67 }];
    const fired = detectTriggers(held, cfg, new Map([q("DAL", 84.0, 85.0)]));
    // (84.00 - 82.67)/84.00 = 1.6% away ≤ 3% → fires
    expect(fired.some((f) => f.startsWith("STOP-ADJACENT DAL"))).toBe(true);
  });

  test("held name comfortably above its stop does not fire", () => {
    const held: HeldPosition[] = [{ symbol: "MU", stop: 991.34 }];
    const fired = detectTriggers(held, cfg, new Map([q("MU", 1080, 1075)]));
    expect(fired.some((f) => f.includes("STOP-ADJACENT"))).toBe(false);
  });

  test("held name with a big intraday move fires MOVE-HELD", () => {
    const held: HeldPosition[] = [{ symbol: "AMD", stop: 514.99 }];
    const fired = detectTriggers(held, cfg, new Map([q("AMD", 560, 520)]));
    expect(fired.some((f) => f.startsWith("MOVE-HELD AMD"))).toBe(true);
  });

  test("a missing quote is skipped, not an error", () => {
    expect(detectTriggers([{ symbol: "X", stop: 1 }], cfg, new Map())).toEqual([]);
  });

  test("null stop never fires STOP-ADJACENT", () => {
    const fired = detectTriggers([{ symbol: "Y", stop: null }], cfg, new Map([q("Y", 10, 10)]));
    expect(fired.some((f) => f.includes("STOP-ADJACENT"))).toBe(false);
  });
});
