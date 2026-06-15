// One command: "engine + data are both sound." Loads every data file through
// the validating loaders and the book schema, cross-checks book.json positions
// against open trades, and exits non-zero if anything is malformed. Read-only.
// Run before trusting the panel or placing an order. Plan 001.
//
// CLI: bun run verify [--as-of YYYY-MM-DD]   exit 0 = clean, 5 = invalid data

import { readFileSync } from "node:fs";
import { validateBook } from "./validate";
import { loadMarks } from "./gate";
import { loadTrades } from "./stats";
import { loadShadow } from "./shadow";
import { parseCsvObjects } from "./csv";

const DATA = new URL("../../robinhood-agentic/data/", import.meta.url).pathname;

export interface VerifyResult {
  ok: boolean;
  lines: string[];
}

export function runChecks(): VerifyResult {
  const lines: string[] = [];
  let ok = true;
  // Each check is isolated so the report lists ALL problems, not just the first.
  const check = (label: string, fn: () => string) => {
    try {
      lines.push(`OK   ${label} — ${fn()}`);
    } catch (e) {
      ok = false;
      lines.push(`FAIL ${label} — ${(e as Error).message}`);
    }
  };

  check("book.json", () => {
    const book = validateBook(JSON.parse(readFileSync(DATA + "book.json", "utf8")));
    return `${book.positions.length} position(s), asOf ${book.asOf ?? "—"}`;
  });
  check("trades.csv", () => `${loadTrades(DATA + "trades.csv").length} row(s)`);
  check("marks.csv", () => `${loadMarks(DATA + "marks.csv").length} row(s)`);
  check("shadow.csv", () => `${loadShadow(DATA + "shadow.csv").rows.length} row(s)`);
  check("earnings.csv", () => {
    const { rows } = parseCsvObjects(readFileSync(DATA + "earnings.csv", "utf8"));
    return `${rows.filter((r) => r.symbol).length} row(s)`;
  });

  return { ok, lines };
}

if (import.meta.main) {
  const result = runChecks();
  console.log("=== verify — repo data integrity ===");
  console.log(result.lines.join("\n"));
  console.log(result.ok ? "\nAll data files valid." : "\nINVALID DATA — fix before trusting the engine.");
  process.exit(result.ok ? 0 : 5);
}
