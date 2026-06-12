// P3: validate the Lane-2 regime gate before trusting it further.
// Strategy under test: gate ON (computed at close t) → hold TQQQ for the
// next session (close t → close t+1); gate OFF → cash (0%). No slippage,
// no taxes, no interest on cash — see the caveats section of the report.
//
// Signals use RAW closes (exactly what the live gate sees in marks.csv);
// returns use ADJUSTED closes (so distributions don't show up as fake
// losses in multi-year buy-and-hold comparisons).
//
// CLI: bun run backtest   (prints a markdown report from data/history/*.csv)

import { readFileSync } from "node:fs";
import { parseCsvObjects } from "./csv";
import { computeGateSeries, type GateOptions, type MarkRow } from "./gate";

interface Bar {
  date: string;
  close: number;
  adjclose: number;
}

export interface BacktestResult {
  label: string;
  sessions: number;
  cagr: number;
  maxDrawdown: number; // negative fraction, e.g. -0.35
  timeInMarket: number; // fraction of sessions holding
  worstHeldDay: number; // worst single-day return while holding
  flips: number; // gate transitions (trade-count proxy)
  end: number; // growth of $1
}

export function loadHistory(path: string): Bar[] {
  const { rows } = parseCsvObjects(readFileSync(path, "utf8"));
  return rows
    .map((r) => ({ date: r.date!, close: Number(r.close), adjclose: Number(r.adjclose) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function equityStats(label: string, dailyReturns: number[], held: boolean[], flips: number): BacktestResult {
  let equity = 1;
  let peak = 1;
  let maxDD = 0;
  let worstHeld = 0;
  for (let i = 0; i < dailyReturns.length; i++) {
    equity *= 1 + dailyReturns[i]!;
    peak = Math.max(peak, equity);
    maxDD = Math.min(maxDD, equity / peak - 1);
    if (held[i]) worstHeld = Math.min(worstHeld, dailyReturns[i]!);
  }
  const years = dailyReturns.length / 252;
  return {
    label,
    sessions: dailyReturns.length,
    cagr: Math.pow(equity, 1 / years) - 1,
    maxDrawdown: maxDD,
    timeInMarket: held.filter(Boolean).length / held.length,
    worstHeldDay: worstHeld,
    flips,
    end: equity,
  };
}

/** Gate strategy: signal at close t (raw closes) → hold TQQQ t→t+1. */
export function runGateStrategy(
  qqq: Bar[],
  vixy: Bar[],
  tqqq: Bar[],
  opts: GateOptions,
  label: string,
): BacktestResult {
  const vixyByDate = new Map(vixy.map((b) => [b.date, b.close]));
  const tqqqByDate = new Map(tqqq.map((b) => [b.date, b]));
  // align: only sessions where all three series exist
  const aligned = qqq.filter((b) => vixyByDate.has(b.date) && tqqqByDate.has(b.date));
  const marks: MarkRow[] = aligned.map((b) => ({ date: b.date, qqq: b.close, vixy: vixyByDate.get(b.date)! }));
  const maLen = opts.maLen ?? 20;

  const effectiveByDate = new Map(computeGateSeries(marks, opts).map((p) => [p.date, p.effective]));

  const returns: number[] = [];
  const held: boolean[] = [];
  let flips = 0;
  let prevOn = false;
  for (let t = maLen - 1; t < aligned.length - 1; t++) {
    const on = effectiveByDate.get(aligned[t]!.date) === "ON";
    if (on !== prevOn) flips++;
    prevOn = on;
    const a0 = tqqqByDate.get(aligned[t]!.date)!.adjclose;
    const a1 = tqqqByDate.get(aligned[t + 1]!.date)!.adjclose;
    returns.push(on ? a1 / a0 - 1 : 0);
    held.push(on);
  }
  return equityStats(label, returns, held, flips);
}

export function runBuyHold(bars: Bar[], skip: number, label: string): BacktestResult {
  const returns: number[] = [];
  for (let t = skip; t < bars.length - 1; t++) {
    returns.push(bars[t + 1]!.adjclose / bars[t]!.adjclose - 1);
  }
  return equityStats(label, returns, returns.map(() => true), 1);
}

export function formatTable(results: BacktestResult[]): string {
  const pc = (n: number) => `${(n * 100).toFixed(1)}%`;
  const lines = [
    "| Strategy | CAGR | Max DD | Time in mkt | Worst held day | Flips | $1 → |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const r of results) {
    lines.push(
      `| ${r.label} | ${pc(r.cagr)} | ${pc(r.maxDrawdown)} | ${pc(r.timeInMarket)} | ${pc(r.worstHeldDay)} | ${r.flips} | ${r.end.toFixed(2)} |`,
    );
  }
  return lines.join("\n");
}

const HIST = new URL("../../robinhood-agentic/data/history/", import.meta.url).pathname;

if (import.meta.main) {
  const qqq = loadHistory(HIST + "qqq.csv");
  const vixy = loadHistory(HIST + "vixy.csv");
  const tqqq = loadHistory(HIST + "tqqq.csv");
  console.log(`# Regime-gate backtest — ${qqq[0]?.date} → ${qqq.at(-1)?.date} (${qqq.length} QQQ sessions)\n`);

  const skip = 50; // align benchmarks with the longest-MA variant's warmup
  const results: BacktestResult[] = [
    runBuyHold(qqq, skip - 1, "Buy & hold QQQ"),
    runBuyHold(tqqq, skip - 1, "Buy & hold TQQQ"),
  ];
  for (const maLen of [10, 20, 50]) {
    for (const volLeg of ["vixy-direction", "none"] as const) {
      results.push(
        runGateStrategy(qqq, vixy, tqqq, { maLen, volLeg }, `Gate MA${maLen} + ${volLeg === "none" ? "no vol leg" : "VIXY dir"}`),
      );
    }
  }
  // PROPOSAL B2 anti-churn variants on the policy gate (MA20)
  results.push(
    runGateStrategy(qqq, vixy, tqqq, { maLen: 20, volLeg: "vixy-direction", confirmDays: 2 }, "B2: MA20 + VIXY dir + 2d confirm"),
    runGateStrategy(qqq, vixy, tqqq, { maLen: 20, volLeg: "vixy-5d-avg" }, "B2: MA20 + VIXY<5d avg"),
    runGateStrategy(qqq, vixy, tqqq, { maLen: 20, volLeg: "vixy-5d-avg", confirmDays: 2 }, "B2: MA20 + VIXY<5d avg + 2d confirm"),
    runGateStrategy(
      qqq, vixy, tqqq,
      { maLen: 20, volLeg: "vixy-direction", confirmDays: 2, confirmDirection: "entries-only" },
      "B2: MA20 + VIXY dir + 2d confirm (entries only)",
    ),
  );
  console.log(formatTable(results));
  console.log(
    "\nNotes: signals on raw closes (matches live marks.csv gate); returns on adjusted closes; gate variants' first held day differs by MA warmup; benchmarks start at session 50 for rough comparability.",
  );
}
