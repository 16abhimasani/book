import { describe, expect, test } from "bun:test";
import { filterSaneBars } from "./backfill";

const bars = (closes: number[]) =>
  closes.map((c, i) => ({ date: `2026-06-${String(10 + i).padStart(2, "0")}`, close: c }));
const vixyFlat = (dates: string[], v = 20) => new Map(dates.map((d) => [d, v]));

describe("filterSaneBars", () => {
  test("a clean ascending series is all kept", () => {
    const b = bars([100, 101, 102, 103]);
    const { kept, rejected } = filterSaneBars(b, vixyFlat(b.map((x) => x.date)));
    expect(kept.length).toBe(4);
    expect(rejected).toEqual([]);
  });

  test("a single +20% QQQ spike is rejected", () => {
    const b = bars([100, 120, 121]); // 100→120 = 20% > 15%
    const { kept, rejected } = filterSaneBars(b, vixyFlat(b.map((x) => x.date)));
    expect(kept.map((k) => k.qqqClose)).toEqual([100, 121]); // 120 rejected; 121 vs 120 = 0.8% ok
    expect(rejected.length).toBe(1);
    expect(rejected[0]).toContain("2026-06-11");
  });

  test("TWO consecutive bad bars are BOTH rejected (carry-bug regression)", () => {
    // 100 → 150 (50%) → 114 (24% vs 150). At the old logic 114 was measured
    // vs the last ACCEPTED close 100 (14% < 15%) and wrongly kept.
    const b = bars([100, 150, 114]);
    const { kept, rejected } = filterSaneBars(b, vixyFlat(b.map((x) => x.date)));
    expect(kept.map((k) => k.qqqClose)).toEqual([100]);
    expect(rejected.length).toBe(2);
  });

  test("VIXY spike is rejected on the vol leg", () => {
    const b = bars([100, 101]);
    const vixy = new Map([
      ["2026-06-10", 20],
      ["2026-06-11", 30], // +50% > 40%
    ]);
    const { kept, rejected } = filterSaneBars(b, vixy);
    expect(kept.length).toBe(1);
    expect(rejected[0]).toContain("VIXY");
  });

  test("a date missing from vixyByDate is skipped with a note", () => {
    const b = bars([100, 101]);
    const vixy = new Map([["2026-06-10", 20]]); // 06-11 missing
    const { kept, rejected } = filterSaneBars(b, vixy);
    expect(kept.length).toBe(1);
    expect(rejected[0]).toContain("no VIXY close");
  });
});
