import { describe, expect, test } from "bun:test";
import { resolveShadow, shadowSummary, type ShadowRow } from "./shadow";
import type { DailyBar } from "./yahoo";

const row = (over: Partial<ShadowRow>): ShadowRow => ({
  candidate_id: "x",
  symbol: "XYZ",
  eval_date: "2026-06-12",
  status: "triggered_shadow",
  entry: 100,
  stop: 92,
  qty: 5,
  reason_skipped: "test",
  exit_date: "",
  exit_price: null,
  shadow_r: null,
  notes: "",
  ...over,
});

const bar = (date: string, close: number): DailyBar => ({ date, close, adjclose: close });

describe("resolveShadow", () => {
  test("close at/below stop resolves stopped at that close (gap-through honest)", () => {
    const r = resolveShadow(row({}), [bar("2026-06-15", 95), bar("2026-06-16", 90)]);
    expect(r.status).toBe("resolved");
    expect(r.exit_date).toBe("2026-06-16");
    expect(r.shadow_r).toBeCloseTo((90 - 100) / 8, 2); // -1.25R, worse than -1R — gap through stop
  });

  test("survives 5 sessions → time-stop exit at 5th close", () => {
    const bars = ["15", "16", "17", "18", "19"].map((d, i) => bar(`2026-06-${d}`, 100 + i * 2));
    const r = resolveShadow(row({}), bars);
    expect(r.status).toBe("resolved");
    expect(r.exit_date).toBe("2026-06-19");
    expect(r.shadow_r).toBeCloseTo(1, 2); // exit 108, risk 8 → +1R
  });

  test("not enough sessions yet → still pending", () => {
    const r = resolveShadow(row({}), [bar("2026-06-15", 101)]);
    expect(r.status).toBe("triggered_shadow");
  });

  test("filtered rows pass through untouched", () => {
    const r = resolveShadow(row({ status: "filtered", entry: null, stop: null }), [bar("2026-06-15", 1)]);
    expect(r.status).toBe("filtered");
  });

  test("bars on/before eval_date are ignored", () => {
    const r = resolveShadow(row({}), [bar("2026-06-12", 80)]); // same-day close below stop must not count
    expect(r.status).toBe("triggered_shadow");
  });
});

describe("shadowSummary", () => {
  test("averages only resolved shadow Rs", () => {
    const rows = [
      row({ status: "resolved", shadow_r: -1 }),
      row({ status: "resolved", shadow_r: 0.5 }),
      row({ status: "filtered", entry: null }),
      row({}),
    ];
    const s = shadowSummary(rows);
    expect(s).toContain("4 candidates");
    expect(s).toContain("-0.25R");
  });
});
