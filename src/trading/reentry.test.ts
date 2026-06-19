import { describe, expect, test } from "bun:test";
import { evaluateReentry, type ReentryInput } from "./reentry";

// A textbook valid re-entry: banked a trailing-stop winner 3 sessions ago, thesis
// still live, not rolling over, pulled back 8% off the high, tape reclaiming.
const GOOD: ReentryInput = {
  exitReason: "trail",
  sessionsSinceExit: 3,
  thesisIntact: true,
  rollingOver: false,
  recentHigh: 100,
  price: 92, // 8% pullback → in band
  tapeConfirms: true,
};

const has = (reasons: string[], needle: string) => reasons.some((r) => r.includes(needle));

describe("evaluateReentry", () => {
  test("all gates met → triggered", () => {
    const r = evaluateReentry(GOOD);
    expect(r.eligible).toBe(true);
    expect(r.triggered).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  test("a stop-out exit is ineligible (thesis broke, capital lost)", () => {
    const r = evaluateReentry({ ...GOOD, exitReason: "stop" });
    expect(r.eligible).toBe(false);
    expect(r.triggered).toBe(false);
    expect(has(r.reasons, "exit")).toBe(true);
  });

  test("a be-scratch exit is ineligible (thesis faded)", () => {
    expect(evaluateReentry({ ...GOOD, exitReason: "be-scratch" }).eligible).toBe(false);
  });

  test("a laggard exit is ineligible (it stopped working — review catch)", () => {
    expect(evaluateReentry({ ...GOOD, exitReason: "laggard" }).eligible).toBe(false);
  });

  test("scaleout is an eligible banked-winner exit", () => {
    expect(evaluateReentry({ ...GOOD, exitReason: "scaleout" }).eligible).toBe(true);
  });

  test("window is inclusive: exactly 5 sessions eligible, 6 not", () => {
    expect(evaluateReentry({ ...GOOD, sessionsSinceExit: 5 }).eligible).toBe(true);
    const stale = evaluateReentry({ ...GOOD, sessionsSinceExit: 6 });
    expect(stale.eligible).toBe(false);
    expect(has(stale.reasons, "window")).toBe(true);
  });

  test("thesis not intact → ineligible", () => {
    const r = evaluateReentry({ ...GOOD, thesisIntact: false });
    expect(r.eligible).toBe(false);
    expect(has(r.reasons, "thesis")).toBe(true);
  });

  test("rolling over → ineligible (directional disqualifier)", () => {
    const r = evaluateReentry({ ...GOOD, rollingOver: true });
    expect(r.eligible).toBe(false);
    expect(has(r.reasons, "rolling over")).toBe(true);
  });

  test("pullback band is inclusive with epsilon: exactly 4.00% triggers, 3.99% does not", () => {
    expect(evaluateReentry({ ...GOOD, price: 96 }).triggered).toBe(true); // 4.00%
    const shallow = evaluateReentry({ ...GOOD, price: 96.01 }); // 3.99%
    expect(shallow.triggered).toBe(false);
    expect(has(shallow.reasons, "pullback")).toBe(true);
  });

  test("pullback band upper edge: exactly 12.00% triggers, 12.01% does not", () => {
    expect(evaluateReentry({ ...GOOD, price: 88 }).triggered).toBe(true); // 12.00%
    expect(evaluateReentry({ ...GOOD, price: 87.99 }).triggered).toBe(false); // 12.01%
  });

  test("eligible but tape not confirming → triggered:false (tape is a separate AND)", () => {
    const r = evaluateReentry({ ...GOOD, tapeConfirms: false });
    expect(r.eligible).toBe(true);
    expect(r.triggered).toBe(false);
    expect(has(r.reasons, "tape")).toBe(true);
  });

  test("property: across pullbacks 0→20%, only [4%,12%] is band-valid", () => {
    for (let pb = 0; pb <= 20; pb++) {
      const r = evaluateReentry({ ...GOOD, recentHigh: 100, price: 100 - pb });
      const expectInBand = pb >= 4 && pb <= 12;
      expect(r.triggered).toBe(expectInBand);
    }
  });

  test("rejects bad inputs (parity with trail/scaleout)", () => {
    expect(() => evaluateReentry({ ...GOOD, price: 0 })).toThrow();
    expect(() => evaluateReentry({ ...GOOD, recentHigh: 0 })).toThrow();
    expect(() => evaluateReentry({ ...GOOD, recentHigh: 90, price: 95 })).toThrow(); // high below price
  });
});
