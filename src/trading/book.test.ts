import { describe, expect, test } from "bun:test";
import { assemblePanel } from "./book";
import type { MarkRow } from "./gate";
import type { TradeRow } from "./stats";

const day = (n: number) => new Date(Date.UTC(2026, 4, 1 + n)).toISOString().slice(0, 10);
const marks: MarkRow[] = Array.from({ length: 21 }, (_, i) => ({
  date: day(i),
  qqq: i === 20 ? 110 : 100,
  vixy: 20 - i * 0.1,
}));

const trades: TradeRow[] = [
  { trade_id: "t1", symbol: "AAA", lane: "L1", entry_date: day(0), risk_usd: 100, exit_date: day(5), pnl_usd: 150, r_multiple: 1.5 },
  { trade_id: "t2", symbol: "BBB", lane: "L2", entry_date: day(1), risk_usd: 100, exit_date: "", pnl_usd: null, r_multiple: null },
];

const cleanBook = {
  accountValue: 5000,
  cash: 1000,
  asOf: day(20),
  positions: [{ symbol: "BBB", qty: 10, entry: 50, stop: 46, price: 51 }],
};

describe("assemblePanel", () => {
  test("clean book raises no flags and reports gate + per-lane stats", () => {
    const p = assemblePanel(cleanBook, marks, trades, day(20));
    expect(p.flags).toEqual([]);
    const text = p.lines.join("\n");
    expect(text).toContain("Gate: ON");
    expect(text).toContain("L1: 1 closed");
    expect(text).toContain("L2: 0 closed / 1 open");
    expect(text).toContain("FLAGS: none");
  });

  test("missing stop and stale snapshot raise flags", () => {
    const bad = {
      ...cleanBook,
      asOf: day(15), // 5 days stale
      positions: [{ symbol: "BBB", qty: 10, entry: 50, stop: null, price: 51 }],
    };
    const p = assemblePanel(bad, marks, trades, day(20));
    expect(p.flags.some((f) => f.includes("NO STOP"))).toBe(true);
    expect(p.flags.some((f) => f.includes("snapshot is 5 day(s) old"))).toBe(true);
    // limits checker independently flags the missing stop too
    expect(p.flags.some((f) => f.startsWith("§2"))).toBe(true);
  });

  test("limit breach surfaces as a flag", () => {
    const breach = {
      ...cleanBook,
      cash: 10, // below 5% buffer
    };
    const p = assemblePanel(breach, marks, trades, day(20));
    expect(p.flags.some((f) => f.includes("cash buffer"))).toBe(true);
  });
});
