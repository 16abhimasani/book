import { describe, expect, test } from "bun:test";
import { brierScore, brierDelta, calibrationBins, type Forecast } from "./brier";

// The harness's headline metric: does our probability beat the market's? A forecast
// is a probability p in [0,1] paired with the realized binary outcome. Brier score =
// mean((p - outcome)^2); lower is better. brierDelta = model - market; NEGATIVE means
// our model beat the market (the only result that justifies any downstream venue work).

describe("brierScore", () => {
  test("perfect forecasts score 0", () => {
    expect(brierScore([{ p: 1, outcome: 1 }, { p: 0, outcome: 0 }])).toBe(0);
  });

  test("maximally wrong forecasts score 1", () => {
    expect(brierScore([{ p: 1, outcome: 0 }, { p: 0, outcome: 1 }])).toBe(1);
  });

  test("a 50/50 guess always scores 0.25 (the no-information baseline)", () => {
    expect(brierScore([{ p: 0.5, outcome: 1 }, { p: 0.5, outcome: 0 }])).toBe(0.25);
  });

  test("rejects empty input and out-of-range probabilities", () => {
    expect(() => brierScore([])).toThrow();
    expect(() => brierScore([{ p: 1.2, outcome: 1 }])).toThrow();
    expect(() => brierScore([{ p: -0.1, outcome: 0 }])).toThrow();
  });
});

describe("brierDelta", () => {
  test("negative when the model beats the market", () => {
    const model: Forecast[] = [{ p: 0.9, outcome: 1 }, { p: 0.1, outcome: 0 }]; // brier 0.01
    const market: Forecast[] = [{ p: 0.6, outcome: 1 }, { p: 0.4, outcome: 0 }]; // brier 0.16
    expect(brierDelta(model, market)).toBeCloseTo(-0.15, 10);
  });

  test("positive when the market beats the model (the edge is dead)", () => {
    const model: Forecast[] = [{ p: 0.4, outcome: 1 }];
    const market: Forecast[] = [{ p: 0.8, outcome: 1 }];
    expect(brierDelta(model, market)).toBeGreaterThan(0);
  });
});

describe("calibrationBins", () => {
  test("a well-calibrated set has observedFreq ~ meanP per populated bin", () => {
    // 10 forecasts at p=0.5, exactly half resolve YES → that bin is perfectly calibrated
    const fs: Forecast[] = Array.from({ length: 10 }, (_, i) => ({ p: 0.5, outcome: (i < 5 ? 1 : 0) as 0 | 1 }));
    const bins = calibrationBins(fs, 10).filter((b) => b.count > 0);
    expect(bins).toHaveLength(1);
    expect(bins[0]!.meanP).toBeCloseTo(0.5, 10);
    expect(bins[0]!.observedFreq).toBeCloseTo(0.5, 10);
    expect(bins[0]!.count).toBe(10);
  });

  test("overconfident forecasts show observedFreq below meanP in the high bin", () => {
    // claim p=0.9 ten times but only 5 resolve YES → meanP 0.9, observedFreq 0.5 (miscalibrated)
    const fs: Forecast[] = Array.from({ length: 10 }, (_, i) => ({ p: 0.9, outcome: (i < 5 ? 1 : 0) as 0 | 1 }));
    const bin = calibrationBins(fs, 10).find((b) => b.count > 0)!;
    expect(bin.meanP).toBeCloseTo(0.9, 10);
    expect(bin.observedFreq).toBeCloseTo(0.5, 10);
  });
});
