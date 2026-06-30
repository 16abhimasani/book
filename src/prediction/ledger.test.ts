import { describe, expect, test } from "bun:test";
import { summarizeLedger, type ShadowRow } from "./ledger";

// The shadow ledger holds one row per evaluated market: our model probability, the
// market's price at eval time, and (once it settles) the realized outcome. summarizeLedger
// reduces the RESOLVED rows to the verdict that gates everything downstream: does our model
// beat the market's price? Brier-delta < 0 = edge present; >= 0 = edge dead (stop).

const row = (over: Partial<ShadowRow>): ShadowRow => ({
  id: "x",
  venue: "polymarket",
  market_id: "m",
  question: "q?",
  eval_ts: "2026-06-29T00:00:00Z",
  market_p: 0.5,
  model_p: 0.5,
  status: "open",
  outcome: null,
  settled_ts: "",
  notes: "",
  ...over,
});

describe("summarizeLedger", () => {
  test("ignores unresolved rows", () => {
    const s = summarizeLedger([row({ status: "open" }), row({ status: "open" })]);
    expect(s.resolved).toBe(0);
    expect(s.brierDelta).toBeNull();
    expect(s.verdict).toContain("no resolved");
  });

  test("model beats market → negative delta, edge-present verdict", () => {
    const rows = [
      row({ status: "resolved", outcome: 1, model_p: 0.9, market_p: 0.6 }),
      row({ status: "resolved", outcome: 0, model_p: 0.1, market_p: 0.4 }),
    ];
    const s = summarizeLedger(rows);
    expect(s.resolved).toBe(2);
    expect(s.brierDelta).toBeCloseTo(-0.15, 10);
    expect(s.verdict.toLowerCase()).toContain("edge");
  });

  test("market beats model → positive delta, edge-dead verdict", () => {
    const rows = [
      row({ status: "resolved", outcome: 1, model_p: 0.4, market_p: 0.8 }),
      row({ status: "resolved", outcome: 0, model_p: 0.6, market_p: 0.2 }),
    ];
    const s = summarizeLedger(rows);
    expect(s.brierDelta!).toBeGreaterThan(0);
    expect(s.verdict.toLowerCase()).toContain("dead");
  });
});
