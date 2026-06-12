import { describe, expect, test } from "bun:test";
import { computeStats, loadTrades, type TradeRow } from "./stats";

const t = (over: Partial<TradeRow>): TradeRow => ({
  trade_id: "id",
  symbol: "SYM",
  lane: "L1",
  entry_date: "2026-06-11",
  risk_usd: 100,
  exit_date: "",
  pnl_usd: null,
  r_multiple: null,
  ...over,
});

describe("computeStats", () => {
  test("empty ledger is graceful (current real state: 3 open, 0 closed)", () => {
    const s = computeStats([t({}), t({}), t({})], { asOf: "2026-06-12" });
    expect(s.closedCount).toBe(0);
    expect(s.openCount).toBe(3);
    expect(s.hitRate).toBeNull();
    expect(s.expectancyR).toBeNull();
    expect(s.gate.eligibleForCapitalAdd).toBe(false);
  });

  test("expectancy = win% × avgWinR − loss% × avgLossR", () => {
    const s = computeStats(
      [
        t({ exit_date: "2026-06-12", r_multiple: 2 }),
        t({ exit_date: "2026-06-12", r_multiple: 2 }),
        t({ exit_date: "2026-06-12", r_multiple: -1 }),
        t({ exit_date: "2026-06-12", r_multiple: -1 }),
      ],
      { asOf: "2026-06-12" },
    );
    expect(s.hitRate).toBe(0.5);
    expect(s.avgWinR).toBe(2);
    expect(s.avgLossR).toBe(1);
    expect(s.expectancyR).toBeCloseTo(0.5, 5);
  });

  test("falls back to pnl/risk when r_multiple column is empty", () => {
    const s = computeStats([t({ exit_date: "2026-06-12", pnl_usd: 150, risk_usd: 100 })], {
      asOf: "2026-06-12",
    });
    expect(s.avgWinR).toBeCloseTo(1.5, 5);
  });

  test("capital-add gate needs all four legs", () => {
    const winners = Array.from({ length: 10 }, (_, i) =>
      t({ trade_id: `w${i}`, entry_date: "2026-06-11", exit_date: "2026-06-20", r_multiple: 1 }),
    );
    // 10 trades, expectancy 1R, 0 breaches — but only ~3 weeks elapsed
    const early = computeStats(winners, { asOf: "2026-07-02" });
    expect(early.gate.trades.ok).toBe(true);
    expect(early.gate.expectancy.ok).toBe(true);
    expect(early.gate.weeks.ok).toBe(false);
    expect(early.gate.eligibleForCapitalAdd).toBe(false);
    // ≥4 weeks → eligible
    const later = computeStats(winners, { asOf: "2026-07-10" });
    expect(later.gate.weeks.ok).toBe(true);
    expect(later.gate.eligibleForCapitalAdd).toBe(true);
    // a breach kills it regardless
    expect(computeStats(winners, { asOf: "2026-07-10", breaches: 1 }).gate.eligibleForCapitalAdd).toBe(false);
  });
});

describe("trades.csv (real file)", () => {
  test("parses; ledger is internally consistent as it grows", () => {
    const path = new URL("../../robinhood-agentic/data/trades.csv", import.meta.url).pathname;
    const trades = loadTrades(path);
    expect(trades.length).toBeGreaterThanOrEqual(3);
    // the original 2026-06-11 seeds anchor at $264.20 combined entry risk
    const seeds = trades.filter((t) => t.entry_date === "2026-06-11");
    expect(seeds.reduce((sum, tr) => sum + tr.risk_usd, 0)).toBeCloseTo(264.2, 2);
    // every closed row must have a recorded R consistent with pnl/risk (±1 cent rounding)
    for (const t of trades.filter((t) => t.exit_date !== "")) {
      expect(t.pnl_usd).not.toBeNull();
      expect(t.r_multiple).not.toBeNull();
      expect(t.r_multiple!).toBeCloseTo(t.pnl_usd! / t.risk_usd, 1);
    }
    // stats must compute without throwing on the live file
    const s = computeStats(trades, { asOf: "2026-06-12" });
    expect(s.closedCount + s.openCount).toBe(trades.length);
  });
});
