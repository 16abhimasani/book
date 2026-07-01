import { describe, expect, test } from "bun:test";
import { CASH_EQUITY, type Venue } from "./venue";
import { checkLimits, sizeFromRisk, type BookInput } from "./risk";

// A hypothetical no-settlement, fractional-unit venue (e.g. on-chain). It exists
// ONLY as a test fixture — proving risk.ts genuinely routes through the descriptor,
// not merely imports it. No such venue ships in this pass.
const FRACTIONAL: Venue = { id: "test-onchain", settledFundsRequired: false, fractionalUnits: true };

describe("venue descriptor wiring", () => {
  test("CASH_EQUITY floors sizing to whole shares (≡ today)", () => {
    // raw = 4585 × 0.05 / 8 = 28.656… → floored to 28 (v0.4.0: 5% risk budget)
    expect(sizeFromRisk(4585, 100, 92).qty).toBe(28); // default param
    expect(sizeFromRisk(4585, 100, 92, CASH_EQUITY).qty).toBe(28);
  });

  test("a fractionalUnits venue returns the un-floored qty (seam routes through descriptor)", () => {
    const raw = (4585 * 0.05) / 8; // 28.65625
    expect(sizeFromRisk(4585, 100, 92, FRACTIONAL).qty).toBeCloseTo(raw, 6);
  });

  test("settledFundsRequired:false omits the settled-funds check entirely", () => {
    const book: BookInput = {
      accountValue: 4585,
      cash: 100,
      positions: [],
      candidates: [{ symbol: "X", qty: 5, entry: 50, stop: 46 }], // cost 250 > cash 100
    };
    const eq = checkLimits(book, CASH_EQUITY);
    expect(eq.checks.some((c) => c.limit === "settled funds only")).toBe(true);
    // a no-settlement venue: the check is ABSENT, not merely passing
    const onchain = checkLimits(book, FRACTIONAL);
    expect(onchain.checks.some((c) => c.limit === "settled funds only")).toBe(false);
  });

  test("default venue ≡ CASH_EQUITY for checkLimits", () => {
    const book: BookInput = { accountValue: 4585, cash: 5000, positions: [], candidates: [] };
    expect(checkLimits(book).checks.length).toBe(checkLimits(book, CASH_EQUITY).checks.length);
  });
});
