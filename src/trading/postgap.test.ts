import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { evaluatePostgap, WATCH_WINDOW, BAND_MIN, BAND_MAX, STOP_PCT, type PostgapInput } from "./postgap";

// A textbook buyable pullback: gapped 2 sessions ago, pulled back 8% off the
// post-gap high onto a higher-low at 91 (above the −8% stop 84.64), reclaiming.
const GOOD: PostgapInput = {
  postGapHigh: 100,
  price: 92,
  higherLow: 91,
  tapeReclaims: true,
  sessionsSinceGap: 2,
};

const has = (reasons: string[], needle: string) => reasons.some((r) => r.includes(needle));

describe("evaluatePostgap", () => {
  test("all gates met → triggered", () => {
    const r = evaluatePostgap(GOOD);
    expect(r.triggered).toBe(true);
    expect(r.stale).toBe(false);
    expect(r.inBand).toBe(true);
    expect(r.stopPlaceable).toBe(true);
    expect(r.reasons).toHaveLength(0);
    expect(r.stopPrice).toBeCloseTo(92 * (1 - STOP_PCT), 6);
  });

  test("past the watch window → stale, prune", () => {
    const r = evaluatePostgap({ ...GOOD, sessionsSinceGap: WATCH_WINDOW + 1 });
    expect(r.stale).toBe(true);
    expect(r.triggered).toBe(false);
    expect(has(r.reasons, "watch window")).toBe(true);
  });

  test("at the window boundary is still fresh", () => {
    const r = evaluatePostgap({ ...GOOD, sessionsSinceGap: WATCH_WINDOW });
    expect(r.stale).toBe(false);
    expect(r.triggered).toBe(true);
  });

  test("pullback too shallow (still extended) → out of band", () => {
    const r = evaluatePostgap({ ...GOOD, price: 98, higherLow: 95 }); // 2% off high
    expect(r.inBand).toBe(false);
    expect(r.triggered).toBe(false);
    expect(has(r.reasons, "outside band")).toBe(true);
  });

  test("pullback too deep (structure failing) → out of band", () => {
    const r = evaluatePostgap({ ...GOOD, price: 85, higherLow: 84 }); // 15% off high
    expect(r.inBand).toBe(false);
    expect(r.triggered).toBe(false);
  });

  test("band edges are inclusive", () => {
    const atMin = evaluatePostgap({ ...GOOD, price: 100 * (1 - BAND_MIN), higherLow: 95 });
    expect(atMin.inBand).toBe(true);
    const atMax = evaluatePostgap({ ...GOOD, price: 100 * (1 - BAND_MAX), higherLow: 87.5 });
    expect(atMax.inBand).toBe(true);
  });

  test("no higher-low formed yet → stop not placeable (the Day-0 trap)", () => {
    const r = evaluatePostgap({ ...GOOD, higherLow: 0 });
    expect(r.stopPlaceable).toBe(false);
    expect(r.triggered).toBe(false);
    expect(has(r.reasons, "no defined higher-low")).toBe(true);
  });

  test("higher-low below the −8% stop → stop rests above structure, not placeable (RIVN 07-02)", () => {
    const r = evaluatePostgap({ ...GOOD, higherLow: 80 }); // stop 84.64 > structure 80
    expect(r.stopPlaceable).toBe(false);
    expect(r.triggered).toBe(false);
    expect(has(r.reasons, "not placeable")).toBe(true);
  });

  test("higher-low at/above price is not a pullback structure", () => {
    const r = evaluatePostgap({ ...GOOD, higherLow: 92 });
    expect(r.stopPlaceable).toBe(false);
    expect(r.triggered).toBe(false);
  });

  test("tape not reclaiming → not triggered (never defaults true)", () => {
    const r = evaluatePostgap({ ...GOOD, tapeReclaims: false });
    expect(r.triggered).toBe(false);
    expect(has(r.reasons, "tape")).toBe(true);
  });

  test("throws when the high is below price (not a pullback)", () => {
    expect(() => evaluatePostgap({ ...GOOD, postGapHigh: 90 })).toThrow();
  });

  test("throws on non-positive inputs", () => {
    expect(() => evaluatePostgap({ ...GOOD, price: 0 })).toThrow();
    expect(() => evaluatePostgap({ ...GOOD, postGapHigh: -1 })).toThrow();
  });
});

// Drift guard, same pattern as policy-sync.test.ts: POLICY §3.1b's prose and
// these constants must never disagree.
describe("POLICY §3.1b ↔ postgap.ts constants", () => {
  const POLICY = readFileSync(new URL("../../robinhood-agentic/POLICY.md", import.meta.url).pathname, "utf8");

  function section31b(): string {
    const start = POLICY.indexOf("§3.1b");
    if (start < 0) throw new Error("POLICY §3.1b not found");
    const end = POLICY.indexOf("- Entry (v0.4.0", start);
    return POLICY.slice(start, end < 0 ? undefined : end).replace(/\s+/g, " ");
  }

  test("window, band, and the CLI are in the §3.1b prose", () => {
    const s = section31b();
    expect(s).toContain(`${WATCH_WINDOW} trading session`);
    expect(s).toContain(`${Math.round(BAND_MIN * 100)}%`);
    expect(s).toContain(`${Math.round(BAND_MAX * 100)}%`);
    expect(s).toContain("bun run postgap");
    expect(s).toContain("postgap-watch.csv");
  });

  test("§3.1b stays additive — the §3 gate and §2 limits are declared unchanged", () => {
    const s = section31b().toLowerCase();
    expect(s).toContain("unchanged");
    expect(s).toContain("loosens nothing");
  });
});
