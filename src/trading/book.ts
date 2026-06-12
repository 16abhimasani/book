// Invariant / audit panel: one command that makes policy breaches, missing
// stops, stale data, the gate state, and the §6a scoreboard impossible to
// miss. Reads REPO state only (book.json, marks.csv, trades.csv) — broker
// ground truth still belongs to the trading loop (skill step 3); this panel
// tells you when the repo's picture of the book is stale or violating.
//
// CLI: bun run book [--as-of YYYY-MM-DD]   exit 0 = clean, 4 = flags raised

import { readFileSync } from "node:fs";
import { checkLimits, formatReport, type BookInput } from "./risk";
import { computeGate, loadMarks } from "./gate";
import { computeLaneStats, computeStats, formatStats, loadTrades } from "./stats";

const DATA = new URL("../../robinhood-agentic/data/", import.meta.url).pathname;

export interface Panel {
  lines: string[];
  flags: string[]; // non-empty = something needs attention
}

export function assemblePanel(
  book: BookInput & { asOf?: string; _note?: string },
  marks: ReturnType<typeof loadMarks>,
  trades: ReturnType<typeof loadTrades>,
  asOfDate: string, // YYYY-MM-DD "today" for staleness checks
): Panel {
  const lines: string[] = [];
  const flags: string[] = [];

  // --- positions & stops ---
  lines.push(`Account $${book.accountValue.toFixed(2)} · settled cash $${book.cash.toFixed(2)} · ${book.positions.length} position(s)`);
  for (const p of book.positions) {
    const stop = p.stop == null ? "NO STOP" : p.stop.toFixed(2);
    const mark = p.price ?? p.entry;
    const pl = ((mark / p.entry - 1) * 100).toFixed(1);
    lines.push(`  ${p.symbol.padEnd(5)} ${String(p.qty).padStart(3)} @ ${p.entry.toFixed(2)}  stop ${stop}  mark ${mark.toFixed(2)} (${pl}%)`);
    if (p.stop == null) flags.push(`${p.symbol}: NO STOP on record`);
  }

  // --- snapshot staleness ---
  if (book.asOf) {
    const ageDays = (Date.parse(asOfDate) - Date.parse(book.asOf.slice(0, 10))) / 86400_000;
    if (ageDays > 1) flags.push(`book.json snapshot is ${Math.floor(ageDays)} day(s) old — refresh from broker before trusting`);
  } else {
    flags.push("book.json has no asOf field — snapshot age unknown");
  }
  const lastMark = marks.at(-1);
  if (lastMark) {
    const markAge = (Date.parse(asOfDate) - Date.parse(lastMark.date)) / 86400_000;
    if (markAge > 4) flags.push(`marks.csv last row is ${lastMark.date} (${Math.floor(markAge)}d old) — EOD appends are not landing`);
  }

  // --- POLICY §2 limits ---
  const report = checkLimits(book);
  lines.push("", formatReport(report));
  for (const c of report.checks.filter((c) => !c.pass)) flags.push(`§2 ${c.limit}: ${c.actual}`);

  // --- regime gate ---
  const g = computeGate(marks, asOfDate);
  if (g.status === "ok") {
    lines.push("", `Gate: ${g.gate} (as of ${g.asOf} close · QQQ ${g.qqqClose.toFixed(2)} vs MA${g.maLen} ${g.ma.toFixed(2)} · vol ${g.volLegPass ? "quiet" : "rising"})`);
  } else {
    lines.push("", `Gate: INSUFFICIENT DATA (${g.have}/${g.need})`);
    flags.push("gate has insufficient data — marks.csv backfill broken?");
  }

  // --- §6a scoreboard (overall + per lane) ---
  const overall = computeStats(trades, { asOf: asOfDate });
  lines.push("", formatStats(overall));
  for (const [lane, s] of computeLaneStats(trades, { asOf: asOfDate })) {
    const f = (n: number | null) => (n == null ? "n/a" : n.toFixed(2));
    lines.push(`  ${lane}: ${s.closedCount} closed / ${s.openCount} open · expectancy ${f(s.expectancyR)}R`);
  }

  lines.push("", flags.length ? `FLAGS (${flags.length}):` : "FLAGS: none — book is clean");
  for (const fl of flags) lines.push(`  ⚠ ${fl}`);
  return { lines, flags };
}

if (import.meta.main) {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const i = args.indexOf("--as-of");
  const asOf = i >= 0 ? args[i + 1]! : new Date().toISOString().slice(0, 10);
  const book = JSON.parse(readFileSync(DATA + "book.json", "utf8"));
  const panel = assemblePanel(book, loadMarks(DATA + "marks.csv"), loadTrades(DATA + "trades.csv"), asOf);
  console.log(`=== Book panel — repo state, queried for ${asOf} ===`);
  console.log(panel.lines.join("\n"));
  process.exit(panel.flags.length ? 4 : 0);
}
