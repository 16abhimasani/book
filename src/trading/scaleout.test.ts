import { describe, expect, test } from "bun:test";
import { computeScaleOut } from "./scaleout";

describe("computeScaleOut", () => {
  test("below +15% → bank nothing, whole position rides the trail", () => {
    const r = computeScaleOut(100, 114, 3); // peak +14%
    expect(r.sellNow).toBe(0);
    expect(r.targetSoldShares).toBe(0);
    expect(r.remainingAfter).toBe(3);
    expect(r.activeTarget).toBeNull();
  });

  test("+15% banks the first third (qty 3 → sell 1, two ride)", () => {
    const r = computeScaleOut(100, 115, 3); // peak +15%
    expect(r.targetSoldShares).toBe(1);
    expect(r.sellNow).toBe(1);
    expect(r.remainingAfter).toBe(2);
    expect(r.activeTarget).toContain("+15%");
  });

  test("+25% banks the second third (qty 3, already sold 1 → sell 1 more, one rides)", () => {
    const r = computeScaleOut(100, 125, 3, 1); // peak +25%, one already banked
    expect(r.targetSoldShares).toBe(2);
    expect(r.sellNow).toBe(1);
    expect(r.remainingAfter).toBe(1); // the last third trails
    expect(r.activeTarget).toContain("+25%");
  });

  test("idempotent: re-running at +25% after both thirds banked sells nothing", () => {
    expect(computeScaleOut(100, 125, 3, 2).sellNow).toBe(0);
  });

  test("1-share position never scales — thirds need ≥3 shares, so it just trails", () => {
    const at15 = computeScaleOut(100, 115, 1);
    const at25 = computeScaleOut(100, 125, 1);
    expect(at15.sellNow).toBe(0);
    expect(at25.targetSoldShares).toBe(0);
    expect(at25.remainingAfter).toBe(1);
  });

  test("2-share position scales once, at +25% (floor of thirds)", () => {
    expect(computeScaleOut(100, 115, 2).sellNow).toBe(0); // floor(1*2/3)=0
    const r = computeScaleOut(100, 125, 2); // floor(2*2/3)=1
    expect(r.sellNow).toBe(1);
    expect(r.remainingAfter).toBe(1);
  });

  test("the float trap: floor(2/3 × 3) must be 2, not 1 (integer math)", () => {
    // naive Math.floor(2/3 * 3) === 1 in IEEE-754; the position would under-bank
    expect(computeScaleOut(100, 125, 3).targetSoldShares).toBe(2);
  });

  test("never oversells: alreadySold beyond target → 0, never negative", () => {
    expect(computeScaleOut(100, 125, 3, 3).sellNow).toBe(0);
  });

  test("DAL-sized position (17 sh): bank 5 at +15%, 11 cumulative at +25%", () => {
    expect(computeScaleOut(100, 115, 17).targetSoldShares).toBe(5); // floor(17/3)
    expect(computeScaleOut(100, 125, 17).targetSoldShares).toBe(11); // floor(34/3)
  });

  test("monotonic: a higher peak never lowers the cumulative target", () => {
    let prev = 0;
    for (let peak = 100; peak <= 140; peak += 1) {
      const t = computeScaleOut(100, peak, 17).targetSoldShares;
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  test("rejects non-positive inputs", () => {
    expect(() => computeScaleOut(0, 125, 3)).toThrow();
    expect(() => computeScaleOut(100, 0, 3)).toThrow();
    expect(() => computeScaleOut(100, 125, 0)).toThrow();
  });
});
