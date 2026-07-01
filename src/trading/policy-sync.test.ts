import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  RISK_PCT,
  BOOK_RISK_PCT,
  SLOT_PCT,
  LEV_PCT,
  BETA_GROSS_PCT,
  THEME_PCT,
  MIN_CASH_PCT,
  MAX_POSITIONS,
} from "./risk";
import { REENTRY_WINDOW, BAND_MIN, BAND_MAX } from "./reentry";

// Drift guard: the binding POLICY.md §2 table and the risk.ts constants that
// actually gate orders must never disagree. Edit one without the other and this
// fails. Plan 003.

const POLICY = readFileSync(
  new URL("../../robinhood-agentic/POLICY.md", import.meta.url).pathname,
  "utf8",
);

// phrase = stable substring identifying the §2 table row; constant = the code
// value. A percentage cell ("40% of account") reads as a fraction; a bare
// integer cell ("4") reads as itself.
const ROWS: { phrase: string; constant: number }[] = [
  { phrase: "Max single position (at entry)", constant: SLOT_PCT },
  { phrase: "Max concurrent positions", constant: MAX_POSITIONS },
  { phrase: "Max combined leveraged-ETF exposure", constant: LEV_PCT },
  { phrase: "Min cash buffer", constant: MIN_CASH_PCT },
  { phrase: "Max risk per position at entry", constant: RISK_PCT },
  { phrase: "Max total open risk to stops", constant: BOOK_RISK_PCT },
  { phrase: "Beta-adjusted gross exposure", constant: BETA_GROSS_PCT },
  { phrase: "Single theme/catalyst concentration at entry", constant: THEME_PCT },
];

function valueForRow(phrase: string): number {
  const line = POLICY.split("\n").find((l) => l.includes(phrase) && l.trimStart().startsWith("|"));
  if (!line) throw new Error(`POLICY §2 row not found for phrase: "${phrase}"`);
  const pct = line.match(/(\d+(?:\.\d+)?)\s*%/); // a percentage anywhere in the value cell
  if (pct) return Number(pct[1]) / 100;
  const int = line.match(/\|\s*(\d+)\s*\|?\s*$/); // a bare integer value cell
  return Number(int?.[1] ?? NaN);
}

describe("POLICY.md §2 ↔ risk.ts constants", () => {
  test("every code constant matches its POLICY row", () => {
    for (const row of ROWS) {
      const policyValue = valueForRow(row.phrase);
      expect(`${row.phrase} = ${policyValue}`).toBe(`${row.phrase} = ${row.constant}`);
    }
  });

  test("the parser matched every expected row (no vacuous pass)", () => {
    // Guards against a POLICY reformat silently making the regex match nothing.
    const found = ROWS.filter((r) => {
      try {
        return Number.isFinite(valueForRow(r.phrase));
      } catch {
        return false;
      }
    });
    expect(found.length).toBe(ROWS.length);
  });
});

// §3.9 (SHADOW) is prose, not a §2 table row — so this couples reentry.ts's tunable
// constants to the §3.9 text. Edit the window or band in one place without the other
// and it fails, same as the §2 guard above.
function section39(): string {
  const start = POLICY.indexOf("### 3.9");
  if (start < 0) throw new Error("POLICY §3.9 section not found");
  const end = POLICY.indexOf("### Lane 4", start);
  // Collapse whitespace so prose may wrap freely without breaking the phrase match.
  return POLICY.slice(start, end < 0 ? undefined : end).replace(/\s+/g, " ");
}

describe("POLICY §3.9 (BINDING v0.4.0) ↔ reentry.ts constants", () => {
  test("window and pullback band match the §3.9 prose", () => {
    const s = section39();
    expect(s).toContain(`${REENTRY_WINDOW} trading session`); // "5 trading session(s)"
    expect(s).toContain(`${Math.round(BAND_MIN * 100)}%`); // "4%"
    expect(s).toContain(`${Math.round(BAND_MAX * 100)}%`); // "12%"
  });

  test("§3.9 is BINDING but re-entry still routes through §2 sizing + a stop", () => {
    // v0.4.0 flipped this live (owner directive). The safety invariant that MUST
    // survive go-live: a triggered re-entry is risk-sized and stopped, not free.
    const s = section39();
    expect(s).toContain("BINDING");
    expect(s).toContain("bun run risk -- size");
    expect(s).toContain("bun run trail");
    expect(s).toContain("every §2 limit");
  });
});
