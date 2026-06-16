import { describe, expect, test } from "bun:test";
import { detectTriggers, dedupe, type WatchConfig, type HeldPosition } from "./watcher";
import type { Quote } from "./yahoo";

const cfg: WatchConfig = { symbols: ["SPCX", "NVDA"], moveAlertPct: 5, stopProximityPct: 3 };
const q = (symbol: string, price: number, prevClose: number): [string, Quote] => [symbol, { symbol, price, prevClose }];
const texts = (ts: { text: string }[]) => ts.map((t) => t.text);

describe("detectTriggers", () => {
  test("watchlist name moving ≥ threshold fires MOVE", () => {
    const fired = texts(detectTriggers([], cfg, new Map([q("SPCX", 122, 100), q("NVDA", 101, 100)])));
    expect(fired.some((f) => f.startsWith("MOVE SPCX +22.0%"))).toBe(true);
    expect(fired.some((f) => f.includes("NVDA"))).toBe(false); // +1% < 5%
  });

  test("held name near its stop fires STOP-ADJACENT", () => {
    const fired = texts(detectTriggers([{ symbol: "DAL", stop: 82.67 }], cfg, new Map([q("DAL", 84.0, 85.0)])));
    expect(fired.some((f) => f.startsWith("STOP-ADJACENT DAL"))).toBe(true);
  });

  test("held name comfortably above its stop does not fire", () => {
    const fired = texts(detectTriggers([{ symbol: "MU", stop: 991.34 }], cfg, new Map([q("MU", 1080, 1075)])));
    expect(fired.some((f) => f.includes("STOP-ADJACENT"))).toBe(false);
  });

  test("held name with a big intraday move fires MOVE-HELD", () => {
    const fired = texts(detectTriggers([{ symbol: "AMD", stop: 514.99 }], cfg, new Map([q("AMD", 560, 520)])));
    expect(fired.some((f) => f.startsWith("MOVE-HELD AMD"))).toBe(true);
  });

  test("a missing quote is skipped, not an error", () => {
    expect(detectTriggers([{ symbol: "X", stop: 1 }], cfg, new Map())).toEqual([]);
  });

  test("null stop never fires STOP-ADJACENT", () => {
    const fired = texts(detectTriggers([{ symbol: "Y", stop: null }], cfg, new Map([q("Y", 10, 10)])));
    expect(fired.some((f) => f.includes("STOP-ADJACENT"))).toBe(false);
  });
});

describe("dedupe", () => {
  const trig = (key: string, price: number) => ({ key, price, text: `${key} ${price}` });

  test("a trigger unchanged since last log is not re-logged (kills off-hours spam)", () => {
    const t = [trig("MOVE:SPCX", 197)];
    const first = dedupe(t, {});
    expect(first.toLog.length).toBe(1); // new → logged
    const second = dedupe(t, first.nextState);
    expect(second.toLog.length).toBe(0); // same price → not re-logged
  });

  test("a trigger that moved ≥1.5% since last log re-logs", () => {
    const state = { "MOVE:SPCX": 197 };
    expect(dedupe([trig("MOVE:SPCX", 200)], state).toLog.length).toBe(1); // +1.5% → re-logs
    expect(dedupe([trig("MOVE:SPCX", 198)], state).toLog.length).toBe(0); // +0.5% → still quiet
  });
});
