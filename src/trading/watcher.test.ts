import { describe, expect, test } from "bun:test";
import { detectTriggers, dedupe, isMarketWindow, summarizeWatcher, type WatchConfig, type HeldPosition } from "./watcher";
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

describe("isMarketWindow", () => {
  test("a weekday mid-session ET time is in window", () => {
    expect(isMarketWindow(new Date("2026-06-15T18:00:00Z"))).toBe(true); // 2pm ET Mon
    expect(isMarketWindow(new Date("2026-06-15T12:00:00Z"))).toBe(true); // 8am ET Mon (pre-market)
  });
  test("overnight and weekends are out of window", () => {
    expect(isMarketWindow(new Date("2026-06-16T05:00:00Z"))).toBe(false); // 1am ET Tue
    expect(isMarketWindow(new Date("2026-06-13T18:00:00Z"))).toBe(false); // 2pm ET Saturday
  });
});

describe("summarizeWatcher", () => {
  const now = new Date("2026-06-15T18:00:00Z");
  test("no data → not-started message", () => {
    expect(summarizeWatcher(null, [], now)).toContain("no data");
  });
  test("fresh scan during hours → running, counts last-24h alerts", () => {
    const events = [`2026-06-15T17:59:00.000Z MOVE SPCX +20%`, `2026-06-10T00:00:00.000Z OLD`];
    const s = summarizeWatcher(new Date("2026-06-15T17:58:00Z"), events, now);
    expect(s).toContain("running");
    expect(s).toContain("1 alert(s)/24h"); // the old one is >24h, excluded
    expect(s).toContain("MOVE SPCX");
  });
  test("stale scan during market hours → flagged as maybe-down", () => {
    expect(summarizeWatcher(new Date("2026-06-15T16:00:00Z"), [], now)).toContain("STALE");
  });
});
