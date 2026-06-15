import { describe, expect, test } from "bun:test";
import { runChecks } from "./verify";

// runChecks reads the live repo data files. The committed data is valid, so the
// integration assertion is simply that the real repo passes. Per-field failure
// behavior is covered exhaustively in validate.test.ts.

describe("runChecks (real repo data)", () => {
  test("the committed data files all validate", () => {
    const result = runChecks();
    // If this fails, a real bad row exists in robinhood-agentic/data — that is a
    // STOP condition for plan 001, not a reason to weaken the test.
    expect(result.ok).toBe(true);
    expect(result.lines.every((l) => l.startsWith("OK"))).toBe(true);
    // one OK line per data file
    expect(result.lines.length).toBe(5);
  });
});
