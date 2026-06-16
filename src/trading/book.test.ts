import { describe, expect, test } from "bun:test";
import { assemblePanel } from "./book";
import type { MarkRow } from "./gate";
import type { TradeRow } from "./stats";

const day = (n: number) => new Date(Date.UTC(2026, 4, 1 + n)).toISOString().slice(0, 10);
// last TWO closes above the MA so the B2-confirmed gate reads ON (not just raw)
const marks: MarkRow[] = Array.from({ length: 21 }, (_, i) => ({
  date: day(i),
  qqq: i >= 19 ? 110 : 100,
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

  test("held position reporting within 14 days raises the earnings flag", () => {
    const p = assemblePanel(cleanBook, marks, trades, day(20), [
      { symbol: "BBB", report_date: day(30), session: "AMC" }, // 10 days out
      { symbol: "ZZZ", report_date: day(22), session: "BMO" }, // not held — ignored
    ]);
    expect(p.flags.some((f) => f.includes("BBB reports") && f.includes("never hold into the print"))).toBe(true);
  });

  test("earnings beyond 14 days or already past do not flag", () => {
    const p = assemblePanel(cleanBook, marks, trades, day(20), [
      { symbol: "BBB", report_date: day(40), session: "AMC" }, // 20 days out
    ]);
    expect(p.flags).toEqual([]);
    const past = assemblePanel(cleanBook, marks, trades, day(20), [
      { symbol: "BBB", report_date: day(10), session: "AMC" },
    ]);
    expect(past.flags).toEqual([]);
  });

  test("limit breach surfaces as a flag", () => {
    const breach = {
      ...cleanBook,
      cash: 10, // below 5% buffer
    };
    const p = assemblePanel(breach, marks, trades, day(20));
    expect(p.flags.some((f) => f.includes("cash buffer"))).toBe(true);
  });

  test("stop above entry raises an informational profit-lock flag (not a §2 failure)", () => {
    const trailed = {
      ...cleanBook,
      positions: [{ symbol: "BBB", qty: 10, entry: 50, stop: 52, price: 53 }],
    };
    const p = assemblePanel(trailed, marks, trades, day(20));
    expect(p.flags.some((f) => f.includes("ABOVE entry") && f.includes("+$20.00"))).toBe(true);
    // it must NOT be reported as a §2 limit violation
    expect(p.flags.some((f) => f.startsWith("§2"))).toBe(false);
  });

  test("a normal stop-below-entry position raises no profit-lock flag", () => {
    const p = assemblePanel(cleanBook, marks, trades, day(20));
    expect(p.flags.some((f) => f.includes("ABOVE entry"))).toBe(false);
  });

  test("P&L shows invested, current, and profit in $ and % (vs contributions, not seed)", () => {
    const withContrib = { ...cleanBook, accountValue: 4911.89, contributions: 4585 };
    const text = assemblePanel(withContrib, marks, trades, day(20)).lines.join("\n");
    expect(text).toContain("Invested $4,585.00 · Current $4,911.89 · Profit +$326.89 (+7.1%)");
    // absent contributions → no P&L line (backward compatible)
    expect(assemblePanel(cleanBook, marks, trades, day(20)).lines.join("\n")).not.toContain("Invested ");
  });
});
