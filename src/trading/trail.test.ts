import { describe, expect, test } from "bun:test";
import { computeTrailStop } from "./trail";

describe("computeTrailStop", () => {
  test("below +5% → the initial −8% hard stop", () => {
    const r = computeTrailStop(100, 103); // peak +3%
    expect(r.stop).toBe(92);
    expect(r.activeRung).toContain("hard stop");
  });

  test("+5% to +8% → breakeven", () => {
    expect(computeTrailStop(100, 106).stop).toBe(100); // peak +6% → BE
  });

  test("+8% rung closes the dead zone (locks +3%, not breakeven)", () => {
    const r = computeTrailStop(100, 108); // peak +8%
    expect(r.stop).toBe(103);
    expect(r.lockedGainPct).toBeCloseTo(3, 5);
    // This is the AMD fix: a +8% peak would have round-tripped to BE before.
  });

  test("+10% → −8% trail, but never below the +3% rung (ratchet up only)", () => {
    // peak +10%: −8% trail = 110×0.92 = 101.2, which is BELOW the +3% rung 103 → stays 103
    expect(computeTrailStop(100, 110).stop).toBe(103);
    // peak +12%: −8% trail = 112×0.92 = 103.04 > 103 → trail takes over
    expect(computeTrailStop(100, 112).stop).toBe(103.04);
  });

  test("+15% tightens to −6%", () => {
    const r = computeTrailStop(100, 115); // −6% = 115×0.94 = 108.1
    expect(r.stop).toBe(108.1);
    expect(r.activeRung).toContain("−6%");
  });

  test("extended winner (+25%) locks hard at −4%", () => {
    const r = computeTrailStop(100, 125); // −4% = 125×0.96 = 120
    expect(r.stop).toBe(120);
    expect(r.lockedGainPct).toBeCloseTo(20, 5);
  });

  test("the MU case: +19% peak now locks ~+12%, not +8.4%", () => {
    // MU entry 941.50, regular-session peak 1109.24 (+17.8%)
    const old = 1109.24 * 0.92; // old flat −8% trail
    const r = computeTrailStop(941.5, 1109.24);
    // +15% rung armed → −6% from peak = 1109.24 × 0.94 = 1042.69
    expect(r.stop).toBeCloseTo(1042.69, 1);
    expect(r.stop).toBeGreaterThan(old); // tighter trail locks more than the old −8%
  });

  test("monotonic: a higher peak never lowers the stop", () => {
    let prev = 0;
    for (let peak = 100; peak <= 160; peak += 1) {
      const s = computeTrailStop(100, peak).stop;
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  test("rejects non-positive inputs", () => {
    expect(() => computeTrailStop(0, 100)).toThrow();
    expect(() => computeTrailStop(100, 0)).toThrow();
  });
});
