import { describe, expect, test } from "bun:test";
import { checkLimits, rMultiple, sizeFromRisk, type BookInput } from "./risk";

describe("sizeFromRisk", () => {
  test("floors qty against the 5% budget (v0.4.0)", () => {
    // $3,103.50 account → $155.18 budget; $8 risk/share → 19 shares
    const s = sizeFromRisk(3103.5, 100, 92);
    expect(s.qty).toBe(19);
    expect(s.riskUsd).toBe(152);
    expect(s.notional).toBe(1900);
  });

  test("a $900 stock with an 8% stop sizes to just 2 shares (v0.4.0)", () => {
    const s = sizeFromRisk(3103.5, 900, 828);
    expect(s.qty).toBe(2); // 155.18 / 72 → 2
    // ...but 2 shares = $1,800 notional; the binding limit is settled cash, which
    // checkLimits catches — sizeFromRisk only enforces the risk budget.
  });

  test("rejects stop at/above entry", () => {
    expect(() => sizeFromRisk(3000, 100, 100)).toThrow();
    expect(() => sizeFromRisk(3000, 100, 105)).toThrow();
  });
});

describe("rMultiple", () => {
  test("2R win", () => {
    expect(rMultiple(100, 92, 116, 5)).toEqual({ r: 2, pnlUsd: 80, riskUsd: 40 });
  });
  test("full stop-out is -1R", () => {
    expect(rMultiple(100, 92, 92, 5).r).toBe(-1);
  });
});

// The known book, exactly as entered 2026-06-11 (initial stops).
const ENTRY_BOOK: BookInput = {
  accountValue: 3000,
  cash: 481.4,
  positions: [
    { symbol: "MU", qty: 1, entry: 941.5, stop: 866.0, levMultiplier: 1, theme: "ai-capex" },
    { symbol: "INTC", qty: 6, entry: 114.15, stop: 105.0, levMultiplier: 1, theme: "ai-capex" },
    { symbol: "TQQQ", qty: 12, entry: 74.35, stop: 63.2, levMultiplier: 3, theme: "ai-capex" },
  ],
};

// Same book after the 06-12 ratchets (MU → breakeven, TQQQ → 65.43),
// marked at official 06-11 closes, account at 06-11 close.
const CURRENT_BOOK: BookInput = {
  accountValue: 3087.27,
  cash: 481.4,
  positions: [
    { symbol: "MU", qty: 1, entry: 941.5, stop: 941.5, price: 995.87, levMultiplier: 1, theme: "ai-capex" },
    { symbol: "INTC", qty: 6, entry: 114.15, stop: 105.0, price: 116.96, levMultiplier: 1, theme: "ai-capex" },
    { symbol: "TQQQ", qty: 12, entry: 74.35, stop: 65.43, price: 76.01, levMultiplier: 3, theme: "ai-capex" },
  ],
};

const riskOf = (b: BookInput) =>
  b.positions.reduce((s, p) => s + Math.max(0, (p.entry - p.stop!) * p.qty), 0);

describe("known book — 2026-06-11 (regression anchors)", () => {
  test("entry risk was exactly $264.20 (8.8% of $3,000)", () => {
    expect(riskOf(ENTRY_BOOK)).toBeCloseTo(264.2, 2);
    expect(riskOf(ENTRY_BOOK) / 3000).toBeCloseTo(0.08807, 4);
  });

  test("post-ratchet risk to stops is $161.94 (5.2%) — NOT the journaled '~$192/5.6%'", () => {
    // MU 0 (breakeven) + INTC 54.90 + TQQQ (74.35-65.43)×12 = 107.04.
    // The 02:10Z journal's "~$192 ≈ 5.6%" mixed the old TQQQ stop with AH
    // account value — unreproducible under any consistent basis. This number
    // is the authoritative one going forward.
    expect(riskOf(CURRENT_BOOK)).toBeCloseTo(161.94, 2);
    expect(riskOf(CURRENT_BOOK) / 3087.27).toBeCloseTo(0.0525, 3);
  });

  test("entry book under v0.4.0 caps: TQQQ 4.5% now within 5% and book 8.8% within 20% — only theme still binds", () => {
    const report = checkLimits(ENTRY_BOOK);
    const byName = (s: string) => report.checks.find((c) => c.limit.includes(s))!;
    expect(byName("risk/position").pass).toBe(true); // TQQQ $133.80 = 4.5% < 5% (v0.4.0)
    expect(byName("risk/position").actual).toBe("all within budget");
    expect(byName("book risk").pass).toBe(true); // 8.8% < 20% (v0.4.0)
    expect(byName("theme").pass).toBe(false); // ai-capex ~84% > 65% (unchanged seatbelt)
  });

  test("current book: book risk inside 20%; theme cap still binds new ai-capex entries", () => {
    const report = checkLimits(CURRENT_BOOK);
    const byName = (s: string) => report.checks.find((c) => c.limit.includes(s))!;
    expect(byName("book risk").pass).toBe(true); // $161.94 = 5.2%
    expect(byName("max 6").pass).toBe(true); // 3 of 6 slots
    expect(byName("cash buffer").pass).toBe(true); // 15.6%
    expect(byName("leveraged-ETF").pass).toBe(true); // TQQQ mark $912 = 29.5%
    expect(byName("beta-adjusted").pass).toBe(true); // ~143.6% < 150%
    expect(byName("beta-adjusted").actual).toContain("143.6%");
    expect(byName("theme").pass).toBe(false); // ai-capex 84.5% > 65% → no adds
    expect(byName("risk/position").pass).toBe(true); // TQQQ 107.04 = 3.5% < 5% (v0.4.0)
  });
});

describe("candidate evaluation", () => {
  test("candidate blocked by settled cash, passes risk budget", () => {
    const book: BookInput = {
      ...CURRENT_BOOK,
      candidates: [{ symbol: "XYZ", qty: 10, entry: 60, stop: 55.2, theme: "biotech" }],
    };
    const report = checkLimits(book);
    const byName = (s: string) => report.checks.find((c) => c.limit.includes(s))!;
    expect(byName("settled funds").pass).toBe(false); // $600 > $481.40
    expect(byName("max 6").pass).toBe(true); // 4th slot is allowed
  });

  test("candidate inside cash + buffer passes the cash checks", () => {
    const book: BookInput = {
      ...CURRENT_BOOK,
      candidates: [{ symbol: "XYZ", qty: 5, entry: 60, stop: 55.2, theme: "biotech" }],
    };
    const report = checkLimits(book);
    const byName = (s: string) => report.checks.find((c) => c.limit.includes(s))!;
    expect(byName("settled funds").pass).toBe(true); // $300 ≤ $481.40
    expect(byName("cash buffer").pass).toBe(true); // $181.40 ≥ $77.18 (2.5% per v0.2.1)
  });

  test("exceeding 6 slots trips the count", () => {
    // CURRENT_BOOK has 3 positions; 4 candidates → 7 total > 6 cap
    const book: BookInput = {
      ...CURRENT_BOOK,
      candidates: ["A", "B", "C", "D"].map((symbol) => ({ symbol, qty: 1, entry: 10, stop: 9.2, theme: symbol })),
    };
    expect(checkLimits(book).checks.find((c) => c.limit.includes("max 6"))!.pass).toBe(false);
  });

  test("missing stop fails the risk check outright", () => {
    const book: BookInput = {
      accountValue: 3000,
      cash: 1000,
      positions: [{ symbol: "NOSTOP", qty: 1, entry: 100, stop: null }],
    };
    const check = checkLimits(book).checks.find((c) => c.limit.includes("risk/position"))!;
    expect(check.pass).toBe(false);
    expect(check.actual).toContain("NO STOP");
  });
});
