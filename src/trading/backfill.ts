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
  const vixyByDate = new Map(vixy.map((b) => [b.date, b]));
  const eligible = qqq.filter((b) => b.date <= lastDate && vixyByDate.has(b.date));
  const window = eligible.slice(-Math.max(MIN_SESSIONS + 5, MIN_SESSIONS)); // a little margin over the minimum
  let added = 0;
  const mismatches: string[] = [];
  const rejected: string[] = [];
  let prevQ: number | null = null;
  let prevV: number | null = null;
  for (const bar of window) {
    const existing = ours.get(bar.date);
    const v = vixyByDate.get(bar.date)!;
    // Sanity bounds: the gate forces real exits off these numbers, and the
    // source is an unofficial endpoint. Reject absurd day-over-day jumps
    // (QQQ ±15%, VIXY ±40% — both beyond any plausible single session)
    // rather than letting a bad print flip the gate.
    if (prevQ != null && Math.abs(bar.close / prevQ - 1) > 0.15) {
      rejected.push(`${bar.date}: QQQ ${bar.close} vs prior ${prevQ} (>15% jump) — REJECTED, gate holds prior state`);
      continue;
    }
    if (prevV != null && Math.abs(v.close / prevV - 1) > 0.4) {
      rejected.push(`${bar.date}: VIXY ${v.close} vs prior ${prevV} (>40% jump) — REJECTED`);
      continue;
    }
    prevQ = bar.close;
    prevV = v.close;
    if (existing) {
      const dq = Math.abs(Number(existing.qqq_close) - bar.close);
      const dv = Math.abs(Number(existing.vixy_close) - v.close);
      if (dq > 0.005 || dv > 0.005) {
        mismatches.push(
          `${bar.date}: ours QQQ ${existing.qqq_close}/VIXY ${existing.vixy_close} vs yahoo ${bar.close}/${v.close} — KEEPING OURS`,
        );
      }
      continue;
    }
    ours.set(bar.date, {
      date: bar.date,
      qqq_close: bar.close.toFixed(2),
      vixy_close: v.close.toFixed(2),
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
