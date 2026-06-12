import { describe, expect, test } from "bun:test";
import { checkLimits, rMultiple, sizeFromRisk, type BookInput } from "./risk";

describe("sizeFromRisk", () => {
  test("floors qty against the 2.5% budget", () => {
    // $3,103.50 account → $77.59 budget; $8 risk/share → 9 shares
    const s = sizeFromRisk(3103.5, 100, 92);
    expect(s.qty).toBe(9);
    expect(s.riskUsd).toBe(72);
    expect(s.notional).toBe(900);
  });

  test("a $900 stock with an 8% stop is unsizable on this account", () => {
    const s = sizeFromRisk(3103.5, 900, 828);
    expect(s.qty).toBe(1); // 77.59 / 72 → 1
    // ...but 1 share = $900 notional; the binding limit is settled cash, which
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

  test("entry book: TQQQ risk (4.5%) and theme (84%) exceed v0.2 caps ratified after entry", () => {
    const report = checkLimits(ENTRY_BOOK);
    const byName = (s: string) => report.checks.find((c) => c.limit.includes(s))!;
    expect(byName("risk/position").pass).toBe(false); // TQQQ $133.80 = 4.5% > 2.5%
    expect(byName("risk/position").actual).toContain("TQQQ");
    expect(byName("book risk").pass).toBe(false); // 8.8% > 8%
    expect(byName("theme").pass).toBe(false); // ai-capex ~84%
  });

  test("current book: book risk back inside 8%; theme cap still binds new ai-capex entries", () => {
    const report = checkLimits(CURRENT_BOOK);
    const byName = (s: string) => report.checks.find((c) => c.limit.includes(s))!;
    expect(byName("book risk").pass).toBe(true); // $161.94 = 5.2%
    expect(byName("max 4").pass).toBe(true); // 3 of 4 slots
    expect(byName("cash buffer").pass).toBe(true); // 15.6%
    expect(byName("leveraged-ETF").pass).toBe(true); // TQQQ mark $912 = 29.5%
    expect(byName("beta-adjusted").pass).toBe(true); // ~143.6% < 150%
    expect(byName("beta-adjusted").actual).toContain("143.6%");
    expect(byName("theme").pass).toBe(false); // ai-capex 84.5% > 65% → no adds
    expect(byName("risk/position").pass).toBe(false); // TQQQ 107.04 = 3.5% (grandfathered)
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
    expect(byName("max 4").pass).toBe(true); // 4th slot is allowed
  });

  test("candidate inside cash + buffer passes the cash checks", () => {
    const book: BookInput = {
      ...CURRENT_BOOK,
      candidates: [{ symbol: "XYZ", qty: 5, entry: 60, stop: 55.2, theme: "biotech" }],
    };
    const report = checkLimits(book);
    const byName = (s: string) => report.checks.find((c) => c.limit.includes(s))!;
    expect(byName("settled funds").pass).toBe(true); // $300 ≤ $481.40
    expect(byName("cash buffer").pass).toBe(true); // $181.40 ≥ $154.36
  });

  test("5th position trips the slot count", () => {
    const book: BookInput = {
      ...CURRENT_BOOK,
      candidates: [
        { symbol: "A", qty: 1, entry: 10, stop: 9.2, theme: "x" },
        { symbol: "B", qty: 1, entry: 10, stop: 9.2, theme: "y" },
      ],
    };
    expect(checkLimits(book).checks.find((c) => c.limit.includes("max 4"))!.pass).toBe(false);
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
