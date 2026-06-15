// One-shot backfill (idempotent, re-runnable):
//  1. robinhood-agentic/data/marks.csv — extend to ≥40 sessions of QQQ/VIXY
//     raw closes. Existing rows are verification anchors: NEVER overwritten;
//     mismatches vs the source are reported and kept as-ours.
//     Schema is deliberately unchanged (date,qqq_close,vixy_close,
//     account_value,notes) — the live EOD run appends rows in that shape per
//     POLICY §4, so adding a tqqq column here would silently misalign it.
//  2. robinhood-agentic/data/history/{qqq,vixy,tqqq}.csv — 3y daily bars
//     (date,close,adjclose) for the P3 backtest; TQQQ history lives here.
//
// CLI: bun run backfill

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseCsvObjects, serializeCsv } from "./csv";
import { fetchDailyBars } from "./yahoo";

const ROOT = new URL("../../robinhood-agentic/data/", import.meta.url).pathname;
const MARKS = ROOT + "marks.csv";
const MIN_SESSIONS = 40;

export interface SaneBar {
  date: string;
  qqqClose: number;
  vixyClose: number;
}

/**
 * Reject bars whose day-over-day jump exceeds the bounds (QQQ ±15%, VIXY ±40%)
 * so a bad print can't flip the regime gate. The baseline for each comparison
 * is the ACTUAL previous close, not the last accepted one — otherwise two
 * consecutive bad bars could slip through if the second's jump from the last
 * good close happens to be under the threshold. Pure + testable.
 */
export function filterSaneBars(
  bars: { date: string; close: number }[],
  vixyByDate: Map<string, number>,
  opts: { qqqJump?: number; vixyJump?: number } = {},
): { kept: SaneBar[]; rejected: string[] } {
  const qqqJump = opts.qqqJump ?? 0.15;
  const vixyJump = opts.vixyJump ?? 0.4;
  const kept: SaneBar[] = [];
  const rejected: string[] = [];
  let prevQ: number | null = null;
  let prevV: number | null = null;
  for (const bar of bars) {
    const vClose = vixyByDate.get(bar.date);
    if (vClose == null) {
      rejected.push(`${bar.date}: no VIXY close — skipped`);
      continue; // no full data for this bar; do not move the baselines
    }
    const reason =
      prevQ != null && Math.abs(bar.close / prevQ - 1) > qqqJump
        ? `${bar.date}: QQQ ${bar.close} vs prior ${prevQ} (>${(qqqJump * 100).toFixed(0)}% jump) — REJECTED, gate holds prior state`
        : prevV != null && Math.abs(vClose / prevV - 1) > vixyJump
          ? `${bar.date}: VIXY ${vClose} vs prior ${prevV} (>${(vixyJump * 100).toFixed(0)}% jump) — REJECTED`
          : null;
    // advance baselines to the immediate predecessor, accepted or not
    prevQ = bar.close;
    prevV = vClose;
    if (reason) {
      rejected.push(reason);
      continue;
    }
    kept.push({ date: bar.date, qqqClose: bar.close, vixyClose: vClose });
  }
  return { kept, rejected };
}

async function main() {
  const { header, rows } = parseCsvObjects(readFileSync(MARKS, "utf8"));
  const ours = new Map(rows.map((r) => [r.date!, r]));
  const lastDate = rows.map((r) => r.date!).sort().at(-1)!;

  const [qqq, vixy, tqqq] = await Promise.all([
    fetchDailyBars("QQQ", "3y"),
    fetchDailyBars("VIXY", "3y"),
    fetchDailyBars("TQQQ", "3y"),
  ]);

  // --- marks.csv: merge, anchors win ---
  const vixyByDate = new Map(vixy.map((b) => [b.date, b.close]));
  const eligible = qqq.filter((b) => b.date <= lastDate && vixyByDate.has(b.date));
  const window = eligible.slice(-Math.max(MIN_SESSIONS + 5, MIN_SESSIONS)); // a little margin over the minimum
  const { kept, rejected } = filterSaneBars(window, vixyByDate);
  let added = 0;
  const mismatches: string[] = [];
  for (const bar of kept) {
    const existing = ours.get(bar.date);
    if (existing) {
      const dq = Math.abs(Number(existing.qqq_close) - bar.qqqClose);
      const dv = Math.abs(Number(existing.vixy_close) - bar.vixyClose);
      if (dq > 0.005 || dv > 0.005) {
        mismatches.push(
          `${bar.date}: ours QQQ ${existing.qqq_close}/VIXY ${existing.vixy_close} vs yahoo ${bar.qqqClose}/${bar.vixyClose} — KEEPING OURS`,
        );
      }
      continue;
    }
    ours.set(bar.date, {
      date: bar.date,
      qqq_close: bar.qqqClose.toFixed(2),
      vixy_close: bar.vixyClose.toFixed(2),
      account_value: "",
      notes: "backfill 2026-06-12 (yahoo raw close; pre-launch, no account)",
    });
    added++;
  }
  const merged = [...ours.values()].sort((a, b) => a.date!.localeCompare(b.date!));
  writeFileSync(MARKS, serializeCsv(header, merged));
  console.log(`marks.csv: ${rows.length} → ${merged.length} rows (+${added} backfilled, anchors preserved)`);
  for (const m of mismatches) console.log(`  MISMATCH ${m}`);
  for (const r of rejected) console.log(`  SANITY ${r}`);
  if (mismatches.length === 0) console.log("  anchors verified: yahoo matches existing rows to the cent");

  // --- history/*.csv for the backtest ---
  mkdirSync(ROOT + "history", { recursive: true });
  for (const [name, bars] of [["qqq", qqq], ["vixy", vixy], ["tqqq", tqqq]] as const) {
    const out = serializeCsv(
      ["date", "close", "adjclose"],
      bars.map((b) => ({ date: b.date, close: b.close.toFixed(2), adjclose: String(b.adjclose) })),
    );
    writeFileSync(`${ROOT}history/${name}.csv`, out);
    console.log(`history/${name}.csv: ${bars.length} bars (${bars[0]?.date} → ${bars.at(-1)?.date})`);
  }
}

main();
