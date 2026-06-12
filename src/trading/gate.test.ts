import { describe, expect, test } from "bun:test";
import { computeGate, computeGateSeries, loadMarks, type MarkRow } from "./gate";

// 2026-05-01 + n days as YYYY-MM-DD (weekends don't matter for the math)
const day = (n: number) => new Date(Date.UTC(2026, 4, 1 + n)).toISOString().slice(0, 10);

function series(qqq: number[], vixy: number[]): MarkRow[] {
  return qqq.map((q, i) => ({ date: day(i), qqq: q, vixy: vixy[i]! }));
}

describe("computeGate", () => {
  test("ON: QQQ above 20d MA and VIXY below prior close", () => {
    const qqq = [...Array(20).fill(100), 110]; // MA ≈ 100.48, close 110
    const vixy = [...Array(20).fill(20), 19];
    const g = computeGate(series(qqq, vixy));
    expect(g.status).toBe("ok");
    if (g.status !== "ok") throw new Error("unreachable");
    expect(g.gate).toBe("ON");
    expect(g.maLeg).toBe(true);
    expect(g.volLegPass).toBe(true);
    expect(g.asOf).toBe(day(20));
  });

  test("OFF: QQQ below MA even with quiet vol", () => {
    const qqq = [...Array(20).fill(100), 90];
    const vixy = [...Array(20).fill(20), 19];
    const g = computeGate(series(qqq, vixy));
    if (g.status !== "ok") throw new Error("expected ok");
    expect(g.gate).toBe("OFF");
    expect(g.maLeg).toBe(false);
  });

  test("OFF: rising VIXY kills the gate even above MA", () => {
    const qqq = [...Array(20).fill(100), 110];
    const vixy = [...Array(20).fill(20), 21];
    const g = computeGate(series(qqq, vixy));
    if (g.status !== "ok") throw new Error("expected ok");
    expect(g.gate).toBe("OFF");
    expect(g.volLegPass).toBe(false);
  });

  test("OFF: flat VIXY is not 'below prior close' (POLICY reads strictly)", () => {
    const qqq = [...Array(20).fill(100), 110];
    const vixy = [...Array(20).fill(20), 20];
    const g = computeGate(series(qqq, vixy));
    if (g.status !== "ok") throw new Error("expected ok");
    expect(g.volLegPass).toBe(false);
    expect(g.gate).toBe("OFF");
  });

  test("volLeg: 'none' ignores VIXY", () => {
    const qqq = [...Array(20).fill(100), 110];
    const vixy = [...Array(20).fill(20), 25];
    const g = computeGate(series(qqq, vixy), undefined, { volLeg: "none" });
    if (g.status !== "ok") throw new Error("expected ok");
    expect(g.gate).toBe("ON");
  });

  test("insufficient data below maLen rows", () => {
    const g = computeGate(series(Array(5).fill(100), Array(5).fill(20)));
    expect(g.status).toBe("insufficient-data");
    if (g.status === "insufficient-data") {
      expect(g.have).toBe(5);
      expect(g.need).toBe(20);
    }
  });

  test("asOf between sessions uses the latest prior session", () => {
    const qqq = [...Array(20).fill(100), 110];
    const vixy = [...Array(20).fill(20), 19];
    const rows = series(qqq, vixy);
    // query a date after the last row: still computes at the last close
    const g = computeGate(rows, "2026-12-31");
    if (g.status !== "ok") throw new Error("expected ok");
    expect(g.asOf).toBe(day(20));
    // query before any row → insufficient
    const g2 = computeGate(rows, "2020-01-01");
    expect(g2.status).toBe("insufficient-data");
  });

  test("custom MA length", () => {
    const qqq = [...Array(10).fill(100), 110];
    const vixy = [...Array(10).fill(20), 19];
    const g = computeGate(series(qqq, vixy), undefined, { maLen: 10 });
    if (g.status !== "ok") throw new Error("expected ok");
    expect(g.gate).toBe("ON");
    expect(g.maLen).toBe(10);
  });
});

describe("vol leg: vixy-5d-avg (B2 research variant)", () => {
  test("passes when VIXY is below its own 5-session average", () => {
    const qqq = [...Array(20).fill(100), 110];
    const vixy = [...Array(16).fill(20), 22, 22, 22, 22, 20]; // 5d avg 21.6, close 20
    const g = computeGate(series(qqq, vixy), undefined, { volLeg: "vixy-5d-avg" });
    if (g.status !== "ok") throw new Error("expected ok");
    expect(g.volLegPass).toBe(true);
    expect(g.gate).toBe("ON");
  });

  test("fails when VIXY is above its 5-session average even if down on the day", () => {
    const qqq = [...Array(20).fill(100), 110];
    const vixy = [...Array(16).fill(20), 20, 20, 26, 25, 24]; // down day-over-day, avg 23, close 24
    const g = computeGate(series(qqq, vixy), undefined, { volLeg: "vixy-5d-avg" });
    if (g.status !== "ok") throw new Error("expected ok");
    expect(g.volLegPass).toBe(false);
  });
});

describe("computeGateSeries confirmation (B2 research variant)", () => {
  // 25 sessions (gate computable from i=19): ON, then a one-day fake-out,
  // then a real two-day flip
  const qqq = [
    ...Array(19).fill(100),
    110, // i=19: ON (first computable session)
    110, // i=20: ON
    90, //  i=21: raw OFF (1-day fake-out)
    110, // i=22: raw ON again
    90, //  i=23: raw OFF
    90, //  i=24: raw OFF (2nd consecutive → real flip)
  ];
  const vixy = [...Array(19).fill(20), 19, 18, 17, 16, 15, 14]; // vol leg always quiet

  test("confirmDays 1 (POLICY default): effective === raw", () => {
    const s = computeGateSeries(series(qqq, vixy), { confirmDays: 1 });
    expect(s.map((p) => p.effective)).toEqual(s.map((p) => p.raw));
  });

  test("confirmDays 2: one-day fake-out is ignored, real flip lands one day late", () => {
    const s = computeGateSeries(series(qqq, vixy), { confirmDays: 2 });
    expect(s.map((p) => p.raw)).toEqual(["ON", "ON", "OFF", "ON", "OFF", "OFF"]);
    expect(s.map((p) => p.effective)).toEqual(["ON", "ON", "ON", "ON", "ON", "OFF"]);
  });
});

describe("marks.csv (real file)", () => {
  const path = new URL("../../robinhood-agentic/data/marks.csv", import.meta.url).pathname;

  test("verification anchors are intact", () => {
    const rows = loadMarks(path);
    const r0610 = rows.find((r) => r.date === "2026-06-10");
    const r0611 = rows.find((r) => r.date === "2026-06-11");
    expect(r0610?.qqq).toBe(693.69);
    expect(r0610?.vixy).toBe(25.68);
    expect(r0611?.qqq).toBe(717.12);
    expect(r0611?.vixy).toBe(24.41);
  });

  test("backfill gives the gate enough history to be deterministic", () => {
    const rows = loadMarks(path);
    expect(rows.length).toBeGreaterThanOrEqual(40);
    const g = computeGate(rows, "2026-06-12");
    expect(g.status).toBe("ok");
  });
});
