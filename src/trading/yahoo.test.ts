import { describe, expect, test } from "bun:test";
import { parseChartResponse } from "./yahoo";

// 2026-06-10 16:00 ET and 2026-06-11 16:00 ET as unix seconds
const T1 = Math.floor(Date.parse("2026-06-10T20:00:00Z") / 1000);
const T2 = Math.floor(Date.parse("2026-06-11T20:00:00Z") / 1000);

const response = (over: Partial<{ timestamp: unknown; close: unknown; adjclose: unknown }> = {}) => ({
  chart: {
    result: [
      {
        timestamp: over.timestamp ?? [T1, T2],
        indicators: {
          quote: [{ close: over.close ?? [693.69, 717.12] }],
          adjclose: [{ adjclose: over.adjclose ?? [693.69, 717.12] }],
        },
      },
    ],
  },
});

describe("parseChartResponse", () => {
  test("well-formed response → bars with ET dates and rounding", () => {
    const bars = parseChartResponse(response(), "QQQ");
    expect(bars).toEqual([
      { date: "2026-06-10", close: 693.69, adjclose: 693.69 },
      { date: "2026-06-11", close: 717.12, adjclose: 717.12 },
    ]);
  });

  test("missing adjclose falls back to close", () => {
    const json = {
      chart: {
        result: [{ timestamp: [T1], indicators: { quote: [{ close: [693.69] }] } }],
      },
    };
    const bars = parseChartResponse(json, "QQQ");
    expect(bars[0]!.adjclose).toBe(693.69);
  });

  test("a null close in the middle is skipped, others kept", () => {
    const bars = parseChartResponse(response({ close: [693.69, null], adjclose: [693.69, null] }), "QQQ");
    expect(bars.length).toBe(1);
    expect(bars[0]!.date).toBe("2026-06-10");
  });

  test("missing chart.result throws", () => {
    expect(() => parseChartResponse({ chart: { error: "Not Found" } }, "QQQ")).toThrow(/Not Found/);
  });

  test("timestamp not an array throws malformed", () => {
    expect(() => parseChartResponse(response({ timestamp: "nope" }), "QQQ")).toThrow(/malformed/);
  });

  test("close length mismatch throws malformed", () => {
    expect(() => parseChartResponse(response({ close: [1] }), "QQQ")).toThrow(/malformed/);
  });

  test("implausible close (zero, negative, overflow) throws bounds", () => {
    expect(() => parseChartResponse(response({ close: [0, 717.12] }), "QQQ")).toThrow(/implausible/);
    expect(() => parseChartResponse(response({ close: [-5, 717.12] }), "QQQ")).toThrow(/implausible/);
    expect(() => parseChartResponse(response({ close: [1e9, 717.12] }), "QQQ")).toThrow(/implausible/);
  });
});
