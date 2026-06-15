// Shadow ledger: every candidate the system evaluates and does NOT trade
// gets a row, and we measure what would have happened. This is the other
// half of the §6a edge question — realized R tells you how taken trades
// did; shadow R tells you whether the *selection* (skips, filters, hygiene
// rules) adds value or just avoids winners.
//
// Statuses:
//   filtered        — candidate's own trigger/invalidation fired pre-entry
//                     (no counterfactual position; recorded to validate filters)
//   triggered_shadow — would have been entered but was skipped by judgment,
//                     limits, or hygiene; carries a hypothetical entry/stop
//                     and resolves like a real trade (close-basis)
//   resolved        — shadow outcome computed (r filled in)
//
// Resolution (close-basis, mirrors the L1 time stop): from eval_date
// forward, first close ≤ stop → stopped at that close; else the 5th
// session close exits. Caveat: close-only bars understate intraday stop
// touches — good enough for a selection-skill signal, not for P&L claims.
//
// CLI: bun run shadow              list ledger + resolve anything due
//      bun run shadow -- --dry     list only, no writes

import { readFileSync, writeFileSync } from "node:fs";
import { parseCsvObjects, serializeCsv } from "./csv";
import { fetchDailyBars, type DailyBar } from "./yahoo";
import { validateShadowRow } from "./validate";

const SHADOW_PATH = new URL("../../robinhood-agentic/data/shadow.csv", import.meta.url).pathname;
const HOLD_SESSIONS = 5; // mirror POLICY §3 L1 time stop

export interface ShadowRow {
  candidate_id: string;
  symbol: string;
  eval_date: string;
  status: string; // filtered | triggered_shadow | resolved
  entry: number | null;
  stop: number | null;
  qty: number | null;
  reason_skipped: string;
  exit_date: string;
  exit_price: number | null;
  shadow_r: number | null;
  notes: string;
}

export function loadShadow(path = SHADOW_PATH): { header: string[]; rows: ShadowRow[] } {
  const { header, rows } = parseCsvObjects(readFileSync(path, "utf8"));
  return {
    header,
    rows: rows
      .filter((r) => r.candidate_id)
      .map((r, i) => validateShadowRow(r, `shadow.csv row ${i + 1}`)),
  };
}

/** Pure resolution: bars must be daily closes sorted ascending. */
export function resolveShadow(row: ShadowRow, bars: DailyBar[]): ShadowRow {
  if (row.status !== "triggered_shadow" || row.entry == null || row.stop == null) return row;
  const after = bars.filter((b) => b.date > row.eval_date);
  if (after.length === 0) return row;
  const riskPerShare = row.entry - row.stop;
  let exit: { date: string; price: number; how: string } | null = null;
  for (let i = 0; i < after.length; i++) {
    const b = after[i]!;
    if (b.close <= row.stop) {
      exit = { date: b.date, price: b.close, how: "stopped (close-basis)" };
      break;
    }
    if (i === HOLD_SESSIONS - 1) {
      exit = { date: b.date, price: b.close, how: `time stop (${HOLD_SESSIONS} sessions)` };
      break;
    }
  }
  if (!exit) return row; // still in the hypothetical hold window
  const r = Math.round(((exit.price - row.entry) / riskPerShare) * 100) / 100;
  return {
    ...row,
    status: "resolved",
    exit_date: exit.date,
    exit_price: exit.price,
    shadow_r: r,
    notes: row.notes ? `${row.notes}; ${exit.how}` : exit.how,
  };
}

export function shadowSummary(rows: ShadowRow[]): string {
  const resolved = rows.filter((r) => r.status === "resolved" && r.shadow_r != null);
  const filtered = rows.filter((r) => r.status === "filtered");
  const pending = rows.filter((r) => r.status === "triggered_shadow");
  const avg = resolved.length ? resolved.reduce((s, r) => s + r.shadow_r!, 0) / resolved.length : null;
  return [
    `Shadow ledger: ${rows.length} candidates · ${resolved.length} resolved · ${pending.length} pending · ${filtered.length} filtered pre-trigger`,
    `Avg shadow R of skipped-but-would-have-triggered: ${avg == null ? "n/a" : avg.toFixed(2) + "R"}`,
    `  (negative = the skips are saving money; positive = the filters may be rejecting winners)`,
  ].join("\n");
}

if (import.meta.main) {
  const dry = process.argv.includes("--dry");
  const { header, rows } = loadShadow();
  const due = rows.filter((r) => r.status === "triggered_shadow");
  let updated = rows;
  if (due.length && !dry) {
    const bySymbol = new Map<string, DailyBar[]>();
    for (const r of due) {
      if (!bySymbol.has(r.symbol)) bySymbol.set(r.symbol, await fetchDailyBars(r.symbol, "3mo"));
    }
    updated = rows.map((r) => (r.status === "triggered_shadow" ? resolveShadow(r, bySymbol.get(r.symbol)!) : r));
    const changed = updated.filter((r, i) => r !== rows[i]).length;
    if (changed) {
      writeFileSync(
        SHADOW_PATH,
        serializeCsv(
          header,
          updated.map((r) => ({
            candidate_id: r.candidate_id,
            symbol: r.symbol,
            eval_date: r.eval_date,
            status: r.status,
            entry: r.entry?.toString() ?? "",
            stop: r.stop?.toString() ?? "",
            qty: r.qty?.toString() ?? "",
            reason_skipped: r.reason_skipped,
            exit_date: r.exit_date,
            exit_price: r.exit_price?.toString() ?? "",
            shadow_r: r.shadow_r?.toString() ?? "",
            notes: r.notes,
          })),
        ),
      );
      console.log(`resolved ${changed} shadow candidate(s)`);
    }
  }
  for (const r of updated) {
    console.log(
      `  ${r.candidate_id.padEnd(18)} ${r.status.padEnd(17)} ${r.entry ? `entry ${r.entry} stop ${r.stop}` : ""}${r.shadow_r != null ? ` → ${r.shadow_r}R` : ""}  [${r.reason_skipped}]`,
    );
  }
  console.log("\n" + shadowSummary(updated));
}
